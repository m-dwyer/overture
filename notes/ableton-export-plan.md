# dAVEBOx → Ableton (.ablbundle) export — implementation plan

**Goal:** A Global-Menu action that exports the current dAVEBOx session (8 tracks × 16 clips) as a
self-contained `.ablbundle` desktop Ableton Live opens — with the mapped Move track instruments +
samples carried over, baked ("what you hear") MIDI, and route-aware track names.

**Companion docs:** `notes/ableton-export-bundle.md` (full format spec + the 6 finalized
UX decisions + bake/loop-brace design). Verify on-device per task (this project has no unit
harness; verification = build/deploy/observe, per CLAUDE.md). Not TDD-stepped for that reason.

---

## Architecture (proposed)

Three responsibilities, split by capability:

- **JS (`ui/ui_export.mjs`, new)** — all JSON + orchestration (text only, which host FS supports):
  read the loaded Move `Song.abl` (`host_read_file` + `JSON.parse`) for per-track instrument
  subtrees/colors/`midiInputMode`; read Schwung `shadow_chain_config.json`; trigger per-clip
  non-destructive render and read baked notes (DSP `get_param`, text); build the export `Song.abl`
  (8×16, instruments, names, region/loop-brace framing, relative `Samples/` refs); emit a
  **sample manifest** (text: `src_abs_path → Samples/<dest>`); write both to a request/staging dir.
- **DSP (`dsp/seq8.c`)** — ONE new capability: **non-destructive render-to-buffer**. Reuses the
  existing pfx pipeline from `bake_clip`/`bake_drum_lane` (the compute *before* the write-back) but
  emits notes via `get_param` instead of mutating the clip. Cheap, in-memory, audio-thread-safe.
- **Packager (binary, off-RT-thread)** — copies binary samples + builds the store-mode zip. **This
  is the architecture decision** (see Phase 0 / Phase 5): default = small **Python helper**
  (move-over pattern). JS writes the request; packager produces `<set>-YYYYMMDD.ablbundle`.

**Why split this way:** host file APIs are string-only (`host_read_file`/`host_write_file`, no
copy, no binary) → JS can't touch binary; binary packaging can't run on the audio thread → can't
be plain DSP either. JS owns JSON (its strength), a binary-capable off-thread packager owns bytes.

### Hard constraints (user 2026-05-23)
- **Fully offline / local** — no network, cloud, or desktop dependency at export time; all reads
  (Move set, samples), bake, and packaging happen on-device. If a Python helper is used it is a
  **local file packager (no network service)** — NOT move-over's Flask pattern.
- **Transport must be STOPPED** — export is a **no-op + OLED notification** ("Stop transport to
  export" or similar) if the sequencer is running. JS gates on its transport-playing state before
  doing anything.

### Finalized decisions (from the spec doc — do not re-litigate)
Output `/data/UserData/schwung/davebox-exports/<set>-YYYYMMDD.ablbundle` (+`-2/-3` dupes) · all 8
tracks always (empty→Dummy Drift) · portable samples · names: Move preset / `SCH-[chain]` /
`Ext ch [n]` / `dB [tr]` · auto bake w/ loop-brace-reveals-extra (delay 2-cycle, random 4-cycle,
both layered, drums same w/ L=LCM cycle) · grid clip N→scene N, clips land stopped.

### Resolved technical specifics
- `BAKE_BUF = MAX_NOTES_PER_CLIP`; existing bake already sizes `bake_out[BAKE_BUF*4]` / `out_cap =
  BAKE_BUF*loops` for up to 4 loops → 4-cycle render fits existing buffers. Drum pool `DRUM_BAKE_POOL=2048`.
- Note tick→beat: 1 bar = 384 DSP ticks, 4 beats/bar → **beats = ticks / 96**; gate(ticks)→duration
  beats same ÷96; velocity 1–127 → float.
- Empty clip slot JSON = `{"hasStop":true,"clip":null}`. clip `region` =
  `{start,end,loop:{start,end,isEnabled}}`; set `region.end` = content extent (N·L beats),
  `region.loop.end` = L (default brace = first cycle). **VERIFY** loop-brace < content opens cleanly
  in Live (standard, but untested in our generated file).
- Sample URI→file: `ableton:/packs/abl-core-library/X`→`/data/CoreLibrary/X`;
  `ableton:/user-library/X`→`/data/UserData/UserLibrary/X`; URL-decode `%20` etc. Leave non-sample
  `ableton:` URIs (presetUri/spriteUri) untouched.
- Dummy instrument = captured Drift `instrumentRack` subtree, saved in repo at
  `notes/ableton-export-drift-dummy.json` (6.4 KB, 0 samples). Clone, set `name`, neutralize macros.

### Open specifics to nail during build (need device / populated data)
- **Channel→instrument map**: how `S.trackRoute[t]` / `S.trackChannel[t]` / `S.trackSchwungSlot[t]`
  resolve to Move `midiInputMode` and Schwung `slot_channels`[4-7] vs `patches`[1-4] offset. Confirm
  against a set with a populated Schwung chain (current slots empty).
- **Trigger from JS→DSP**: new global `set_param` keys are silently dropped (CLAUDE.md) — the render
  trigger must be a per-track `tN_*` key or piggybacked.
- **Drum noteNumber alignment** with target drumRack cells (should hold by construction; verify).

---

## Phase 0 — De-risk: host binary byte-safety (decides architecture)
**Why first:** if host FS is byte-preserving, the whole packager collapses to JS and Phases 5/6 shrink.
- [ ] Add a temporary DSP/JS probe: `host_write_file` a known binary blob (bytes 0x00–0xFF), read it
  back, compare. Deploy, run, check `seq8.log`.
- [ ] **If byte-safe** → packager = JS (store-mode zip + sample bytes in JS); skip the helper. Revise
  Phases 5–6 accordingly.
- [ ] **If not** (expected) → proceed with the Python-helper packager (Phase 5). Remove the probe.

### Phase 0 RESULT — 2026-05-23 (resolved by source + device tooling probe, no byte-blob deploy needed)
**host FS is NOT byte-safe** (settled from `~/schwung/src/shadow/shadow_ui.c` source — authoritative):
- `host_write_file` (shadow_ui.c:1969): `len = strlen(JS_ToCString(content))` + `fwrite`. JS string →
  UTF-8: embedded `0x00` truncates the write; bytes `0x80–0xFF` get UTF-8-expanded. Binary write unsafe.
- `host_read_file` (shadow_ui.c:1923): `fread` then `JS_NewString` (NUL-terminated UTF-8) → truncates
  at first `0x00`, mangles invalid UTF-8. Binary read unsafe.

**BUT a third, better architecture exists — neither "JS-only zip" nor "Python-helper daemon":**
- `host_system_cmd(cmd)` (shadow_ui.c:1779, **stock Schwung** — upstream `fb44ccbf`, not in our patch):
  prefix-allowlisted (`tar/cp/mv/mkdir/rm/ls/test/chmod/`**`sh`**); `sh ` prefix ⇒ effectively
  arbitrary commands via `sh -c '...'`. fork+execl `/bin/sh` at SCHED_OTHER. **Returns exit code only**
  (no stdout → redirect to a file + `host_read_file` to capture output).
- `host_read_file_base64` (shadow_ui.c:3080, **stock** — upstream PR #61): byte-safe READ fallback if
  ever needed (we won't — samples go through the OS, not JS).
- **Device tooling (ssh probe):** NO `zip` binary (busybox has only `unzip`/`gzip`/`tar`); **`python3`
  3.10.18 at `/usr/bin/python3` WITH `zipfile`** ✅. Verified end-to-end on device: python3 `zipfile`
  (`ZIP_STORED`) produced a `.ablbundle` with `Song.abl` at root + `Samples/test.wav` (2048 binary
  bytes intact), `unzip -l` confirms structure.

**DECIDED architecture (supersedes the JS-zip-vs-Python-helper fork above):**
- **JS** (`ui_export.mjs`): orchestration + build `Song.abl` JSON (text → `host_write_file`, safe since
  JSON is UTF-8 text) + emit a text **manifest** (sample `src_abs → Samples/<dest>`).
- **DSP**: non-destructive render-to-buffer for baked MIDI (`get_param` text). Unchanged.
- **Packager** = a `pack.py` (shipped in the module dir) invoked **once** via
  `host_system_cmd("sh -c '/usr/bin/python3 <pack.py> <staging> <out.ablbundle>'")` — copies binary
  samples into staging `Samples/` (OS-level, never through JS) + builds the `ZIP_STORED` bundle.
  Fully on-device, offline, **no daemon, no network, no JS byte-writer**. Ships from `main` to stock
  Schwung (host_system_cmd + python3 both stock) → **no capability gate needed**.
- Byte-safety of `host_write_file` is now **irrelevant** to the design (binary never touches JS).

**One thing still to confirm on first real build (Phase 1):** that `host_system_cmd` actually executes
from inside the shadow_ui process context (allowlist + fork/exec + PATH) — ssh login shell ≠ shadow_ui
child env; use absolute `/usr/bin/python3` to be PATH-independent. Verify during Phase 1 deploy.

## Phase 1 — Skeleton: menu + empty 8×16 bundle (no instruments/samples/MIDI yet)
Proves the pipeline produces a Live-openable bundle from dAVEBOx.
- [ ] `ui/ui_export.mjs`: `exportSession()` stub; add **"Export to Ableton"** to
  `buildGlobalMenuItems()` (`ui/ui.js:153`).
- [ ] **Transport guard:** `exportSession()` first checks JS transport-playing state — if running,
  `showActionPopup('STOP','TRANSPORT TO EXPORT')` (or similar) and return (no-op). All later phases
  assume stopped transport.
- [ ] Build a minimal `Song.abl`: 8 tracks, 16 empty scenes, each track carries the **Dummy Drift**
  (from the captured template), names = `dB 1..8`, global tempo/key/scale from dAVEBOx.
- [ ] Write `Song.abl` to staging; package via chosen packager into
  `davebox-exports/<set>-YYYYMMDD.ablbundle` (dup-suffix logic).
- [ ] **Verify:** bundle into Live → opens, 8 tracks × 16 scenes, all named, Drift on each.

### Phase 1 RESULT — 2026-05-23 (device + desktop-Live verified ✅; on branch `ableton-export`, UNCOMMITTED)
Done as designed, with these specifics:
- `ui/ui_export.mjs` (new): `requestExport()` (menu action) → confirm dialog → `confirmExportStart()`
  → `pollPendingExport()` (tick drain — get_param('bpm') needs tick context). Menu action runs in
  on_midi where get_param is null, so all work is deferred to tick (codebase idiom).
- **Confirm/cancel dialog** added (user request) — modeled on Clear Session: `S.confirmExport` /
  `S.confirmExportSel` (0=Yes,1=No default); `drawExportConfirm()` in `ui_dialogs.mjs`; jog toggles,
  jog-click commits, Back cancels; wired into the 2 commit/jog/cancel handler blocks + pad guard.
- **Transport guard = stop-transport notice** (`showStopTransportNotice()`), held 2× normal popup
  duration (`ACTION_POPUP_TICKS*2`, user request). Checked at both menu-select and Yes-commit.
- `Song.abl` built from scratch in JS (8 `kind:midi` tracks, each a cloned Drift dummy named `dB N`,
  16 empty clipSlots `{hasStop:true,clip:null}`, real captured master subtree, `$schema` 1.8.2).
  Carries **tempo + rootNote(key)**; **scale hard-coded "Major"** (Phase 3 maps it); no notes.
- **Packager shipped as module files**: `export/pack.py` + `export/ableton-master.json` +
  `notes/ableton-export-drift-dummy.json` → copied to `dist/davebox/` by `build.sh`; read at runtime
  from the module dir. JS-only deploys ship them too (install.sh scp's all of dist/davebox).
- `pack.py` invoked via `host_system_cmd("sh -c '/usr/bin/python3 .../pack.py .../pack-args.json'")`;
  args (incl. space-containing set name + out path) passed via `pack-args.json`, status read back from
  `pack-status.json`. Output `/data/UserData/schwung/davebox-exports/<set>-YYYYMMDD[-N].ablbundle`.
- **Confirmed on device:** host_system_cmd fires python3 from shadow_ui; dup-suffix `-2` works; bundle
  opens in desktop Live with 8 named tracks × 16 empty scenes + Drift on each, correct tempo.
- Bundler `ORDER` + `S.pendingExport`/`S.confirmExport*` state added.

## Phase 2 — Instruments + names (route-aware mapping)
- [ ] Read loaded Move `Song.abl`; build channel→Move-track map from `midiInputMode`.
- [ ] Per dAVEBOx track: ROUTE_MOVE → copy matched Move track's `devices` subtree + name=preset;
  ROUTE_SCHWUNG → Dummy Drift + name=`SCH-[chain]` (from `shadow_chain_config.json`); EXTERNAL →
  Dummy + `Ext ch [n]`; none → Dummy + `dB [tr]`. Track colors from mapped Move track / dB defaults.
- [ ] **Verify:** instruments load in Live; names correct; re-channel a Move track → still maps right.

## Phase 3 — Baked MIDI (melodic)
- [ ] DSP: add non-destructive render-to-buffer (melodic) — copy `bake_clip` compute (`seq8.c:6077–6159`),
  emit notes via a `tN_cC_*` `get_param` as `tick:gate:pitch:vel;`. Trigger via per-track key.
- [ ] JS: for each non-empty melodic clip, render, read notes, convert ticks→beats, fill `notes[]`;
  set `region`/`region.loop` per loop-brace design (Phase 4b adds the multi-cycle framing).
- [ ] **Verify:** a melodic clip plays in Live identical to dAVEBOx (incl. pfx, since baked).

## Phase 4 — Drums (flatten + LCM)
- [ ] DSP: non-destructive render-to-buffer (drum) from `bake_drum_lane` compute; per-lane notes at
  `dl->midi_note`.
- [ ] JS: compute LCM of active lanes' lengths (in ticks); tile each lane across LCM; merge to one
  `notes[]`; clip length = LCM (cap policy: clamp to N bars / max length, snap to clean loop).
- [ ] **Verify:** a polymetric drum clip (lanes of differing lengths) loops correctly in Live.

## Phase 4b — Bake options (loops/wrap + loop-brace layout)
- [ ] Auto-detect per clip/lane from pfx: randomization → 4 cycles; delay → wrap (2-cycle layout);
  both → layered (cycle 1 clean, 2–4 random+wrapped); else 1 cycle.
- [ ] Set `region.end` = N·L (content), `region.loop` = first cycle. Drums: L = LCM cycle.
- [ ] **Verify:** randomized clip → expanding the loop brace in Live reveals variety; delayed clip →
  moving brace toggles unwrapped/wrapped.

## Phase 5 — Samples (portable) + packager
- [ ] JS: while copying instrument subtrees, collect every `sampleUri`; resolve URI→abs file; rewrite
  ref to relative `Samples/<basename>` (dedupe basenames); emit manifest.
- [ ] Packager (Python helper unless Phase 0 said JS): copy binary samples → `Samples/`; build
  store-mode `.ablbundle` zip (Song.abl@root + Samples/). Deploy + auto-start helper if daemon.
- [ ] JS: poll for output bundle; show progress/done in OLED.
- [ ] **Verify:** export on a machine *without* the packs → still opens with all sounds.

## Phase 6 — Polish
- [ ] Progress/most-recent-export feedback; error handling (missing sample, oversized clip, no clips).
- [ ] MANUAL.md + CHANGELOG entries; capability-gate if any patched-Schwung dependency.
- [ ] **Verify:** full 8×16 session with drums, melodic, Schwung + external tracks, randomized +
  delayed clips → opens in Live, sounds like dAVEBOx, names/colors correct.

## Risks
- Phase 0 outcome flips the packager design. · Helper trigger/auto-start mechanism (daemon vs
  DSP-spawn) — confirm on-device. · LCM cap for pathological coprime drum lanes. · region/loop-brace
  rendering in Live (verify early, Phase 1/3). · Live 12.1+ for Drum Sampler; export is one-way.

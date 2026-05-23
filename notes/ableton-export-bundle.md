# dAVEBOx → Ableton export via `.ablbundle` — confirmed format spec

**Verified on desktop Ableton Live 2026-05-23.** Goal: export a dAVEBOx session (8 tracks ×
16 clips) into desktop Ableton **with the associated Move track presets + samples**. The path
is to emit a Move-style **`.ablbundle`** (NOT hand-rolled `.als`) — Live opens it, converts the
instruments natively, and the user saves as `.als`. See `notes/move-native-state-files.md` for
the underlying Move file/state details.

## Why `.ablbundle`, not hand-rolled `.als`
`.als` is Live's native device representation (undocumented, version-specific XML). Authoring
MIDI/structure in `.als` is doable, but authoring Move's **instruments** into `.als` means
re-implementing Ableton's own Move→Live converter — fragile, and the instruments wouldn't load.
`.ablbundle` carries the instruments in Ableton's *song* schema (the JSON we already read/write)
and Live does the native conversion on open. Per Ableton docs the bundle "includes all the files
needed to open in Live… samples, clips, and presets"; Live loads it as a new Set you save as `.als`.

## CONFIRMED facts (control tests, all in Live)
- **Bundle layout** = a ZIP with `Song.abl` at the **root** + a `Samples/` folder at root
  (samples are `Samples/<name>.wav|.aif`; there's also a `Samples/Recordings/` subdir). ✅ opens.
- **JSON round-trip is safe** — `json.load` + `json.dumps` (compact, no indent) of a real
  `Song.abl`, re-zipped, opens fine. So we can author the JSON programmatically. ✅
- **8 tracks × 16 scenes opens in Live.** ✅ (Tested by extending a real 8-track Note bundle —
  `Set 38.ablbundle` — from 8 to 16 scenes/clipSlots; opened great with instruments + 44 samples
  intact.) The Move 4-track / 8-scene limits are **Move-ingestion only**, not the format or Live.
- **Every track MUST have an instrument device.** A track with `devices: []` → Live rejects the
  whole file: **"Error loading document: Document invariant violation."** This was the cause of
  the first failed attempt (fabricated tracks 5–8 with empty devices). Every real track has
  `devices:[{kind:'instrumentRack', ...}]`.

## Schema cheat-sheet (from real Move + Note `Song.abl`)
Top-level keys: `$schema, stepEditorResolution, tempo, globalGrooveAmount, [timeSignature],
rootNote, scale, melodicLayout, tracks, returnTracks, masterTrack, scenes, grooves, metadata`.
- `timeSignature` (`{upper,lower}`) present in Note sets, absent in this Move set — version diff.
- `scenes`: `[{name, color}]`. clipSlots per track must line up with scene count.
- `masterTrack`: `{color,isSelected,devices,mixer}` — **no clipSlots**. `returnTracks` can be `[]`.

Track: `{kind:'midi', name, color (palette idx), isSelected, clipSlots[], isNoteRepeatOn,
noteRepeatRate, noteRepeatArpeggio, uiOctaveIndex, midiInputMode, midiOutputEndpoint, devices[], mixer}`.
- `midiInputMode`: accepts the **string `"auto"`** (Note sets) OR an **array `[N]`** = MIDI-in
  channel (Move sets; proven by the +1 experiment).
- `devices[0]`: `{presetUri, kind:'instrumentRack', name (preset name), lockId, lockSeal,
  parameters:{Enabled, Macro0..7}, chains:[...]}`. Inner `chains[0].devices[0].kind` =
  `drumRack` (drum kit) vs `instrumentRack` (melodic) — the drum/melodic tell.

clipSlot: `{hasStop:bool, clip: <clip>|null}`. Empty slot = `{"hasStop":true,"clip":null}`.
clip: `{isPlaying, name, color, isEnabled, [timeSignature], region, grooveId,
stepEditorScrollPosition, notes, envelopes}`.
- `region`: `{start, end, loop:{start, end, isEnabled}}` (e.g. start 0.0 end 8.0 = length in beats).
- `notes`: `[{noteNumber, startTime, duration, velocity, offVelocity}]` — startTime/duration in beats.

## Design implications for the export feature
1. **Authoring `Song.abl` in JS** is feasible (build the dict, `JSON.stringify`, write). The ZIP
   step needs a way to produce a `.ablbundle` on-device (zip) — `host` FS may not zip; likely a
   small helper (busybox `zip`? python `zipfile`? DSP-side?). Open implementation question.
2. **Every exported track needs an instrument** (the invariant). For dAVEBOx tracks that map to a
   Move track (channel match vs `midiInputMode`) → copy that Move track's `devices` subtree. For
   dAVEBOx tracks with **no** mapped Move instrument (e.g. Schwung-routed) → use a **Dummy** Drift
   instrument. **Template CAPTURED 2026-05-23**: a real Drift `instrumentRack` subtree (6.4 KB, **0
   sampleUris** — pure synth, nothing to bundle) saved at `/tmp/drift-dummy-device.json` /
   `~/Desktop/drift-dummy-device.json`. Clone it, set `name`, neutralize macros for a clean default.
   Device-instrument kinds seen across sets: drumCell(240), instrumentRack(91), drift(18),
   wavetable(17), melodicSampler(6) + fx (saturator/reverb/delay/chorus/compressor/limiter/etc.) —
   copying a track's device subtree carries its fx chain too.
3. **Samples — SOLVED (from real bundle `Set 38.ablbundle`).** Device chains reference samples
   via a **`sampleUri`** field = a **relative, URL-encoded path into the bundle**, e.g.
   `"sampleUri": "Samples/Kick%204.wav"` (44 sampleUris ↔ 44 files in the zip's `Samples/`).
   Located deep in the chain: `…/devices[0]/chains[0]/devices[0]/chains[0]/devices[0]/deviceData/sampleUri`.
   Other URI fields are **NOT bundled** — Live resolves them: `presetUri`
   (`ableton:/user-library/…ablpreset` or `ableton:/packs/…` — origin only), `spriteUri1/2`
   (`ableton:/device-resources/wavetable-sprites/…` — built-in Wavetable shapes).
   **Export rule:** walk each copied device subtree; for every `sampleUri` whose value is a local
   path (not `ableton:`), copy that file into the export's `Samples/` and keep the relative
   `Samples/<name>` ref; leave any `ableton:/…` URI untouched.
   **Source-side resolution — SOLVED 2026-05-23 (device scan of all 14 sets).** On-disk Move sets
   do NOT keep local sample files — **every** sample ref is an `ableton:/…` URI (0 sets used local
   samples). Note's bundle had a local `Samples/` because **Note's exporter resolves those URIs to
   files and bundles them** — we do the same. URI → filesystem mapping (URL-decode `%20`→space):
   - `ableton:/packs/abl-core-library/<path>` → **`/data/CoreLibrary/<path>`**
     (confirmed: `…/Samples/Drums/Kick/Kick Caltroit.wav` → `/data/CoreLibrary/Samples/Drums/Kick/Kick Caltroit.wav`)
   - `ableton:/user-library/<path>` → **`/data/UserData/UserLibrary/<path>`** (confirmed dir + a real `.ablpreset` resolve)
   **Export sample step:** walk copied device subtrees; for each `sampleUri` (which here are all
   `ableton:` on disk), resolve URI→file, copy the file into the bundle's `Samples/`, and rewrite
   the ref to relative `Samples/<basename>`. `spriteUri`/`presetUri` (`ableton:/device-resources/…`,
   pack/user-library preset origins) are Live-resolved → leave untouched. (Bundling = portable like
   Note; alternatively leave `ableton:` refs as-is for a smaller bundle that needs the packs present
   in the target Live.)
4. **Track naming/colors/type** from the mapped Move track (preset name, color, drum-vs-melodic).
5. **MIDI**: convert dAVEBOx clips → `notes[]` (beats), with pfx baked (existing TODO scope).
6. **Caveats** (Ableton docs): Move Drum Racks need **Live 12.1+** (older → Drum Sampler becomes
   Simpler, sounds different); export is **one-way** (a saved `.als` can't go back to Move).

## Drum clips — render to LCM before flattening (IMPORTANT)
Ableton has no drum-clip type: every clip is a plain `notes[]` (`noteNumber` = drum cell note);
"drum-ness" is the **track's `drumRack`**, not the clip. So a drum clip exports as notes whose
`noteNumber` = each lane's MIDI note. Those note numbers align **by construction** with the target
Move drumRack's cells (same notes dAVEBOx already sends that drum track — verify on-device, but no
remap needed).

**The catch:** dAVEBOx drum **lanes have independent loop lengths** (per-lane window
`t%dc%dl%d_ls`) — they polymeter. A single Ableton clip is one fixed-length region and can't hold
independent per-lane loops, so a raw flatten freezes them and breaks the polymeter. The existing
`bake_drum_lane` (`dsp/seq8.c:6180`) bakes **each lane to its own length** (correct in-app; keeps
the polymeter as separate loops) — it does NOT collapse lanes onto a common timeline. So export
needs new logic:
1. **Export clip length = LCM of the active lanes' lengths, computed in TICKS** (each lane has its
   own `ticks_per_step`, so steps aren't a common unit — use ticks).
2. **Render each lane's heard notes tiled across the LCM span** (each lane's pattern repeats to
   fill it), reusing the per-lane pfx compute from `bake_drum_lane`.
3. **Merge all lanes into one `notes[]`**, clip region length = LCM. Looped, it reproduces the
   polymeter exactly.

Reusable: per-lane pfx math. New: the LCM-tile-and-merge (in-app bake doesn't do it). **Cap policy
needed:** coprime lane lengths blow up the LCM (3·5·16 → 240 steps; worse combos explode);
`clip_init` clamps clip length to 256 and Ableton has practical limits — so cap the export clip at
N bars / a max LCM and snap to the nearest clean loop. Rare in practice.

Melodic clips have no intra-clip polymeter (one clip = one length) → bake to the clip's own length,
no LCM. Cross-*track* polymeter is preserved for free (each track exports its own clip + length).

## Bake options: loops + wrap (per-clip / per-lane)
The render-to-buffer inherits `bake_clip`/`bake_drum_lane`'s two existing params (original TODO:
"4x loop bake for random pfx, wrap-around for delay"):
- **`loops`** — bakes N passes, **randomizer reset each pass** (`fx.note_random_walk = 0`,
  `dsp/seq8.c:6105` melodic / `:6226` drum) → captures N distinct variations of a randomized clip
  instead of one frozen loop. Exported melodic clip length = clip length × loops. (In-app clamps
  1–4; export could allow more, but check `BAKE_BUF`/`out_cap` sizing first.)
- **`wrap`** — folds notes/delay tails past the clip end back to start (`tick %= total_ticks`;
  MIDI-delay stage gets `UINT32_MAX` on the last loop) → seamless loop with delay repeats.

**Scope = per-clip (melodic) / per-lane (drum)**, NOT per-track. pfx (randomization, delay) lives
in `cl->pfx_params` (melodic clip) and `dl->pfx_params` (drum lane). So **auto-detect per clip /
per lane**: if its pfx has randomization → bake multiple loops; if it has delay → wrap on. Optional
override in the export dialog. (User is "don't make me think about bake internals" — favor
auto-detect.)

**Interaction with drum-LCM:** drum lanes already tile across the LCM span with a fresh random pass
per repeat, so the LCM tiling largely *subsumes* loop-count-for-randomization on drums. Explicit
loop-count matters mainly for **melodic** clips (single region, no LCM). Don't double-count length.

### DECIDED — auto + "loop-brace reveals extra content" (user 2026-05-23)
Fully automatic, but smart: bake MORE content than the default loop and set the **clip's default
loop brace = original dAVEBOx clip length L** (the clean first loop). Extra baked material lives in
the clip *past* the brace; the user drags/expands the loop brace in Ableton to reveal it. This needs
the export to set `region` (content extent = N·L) and `region.loop` (brace = `[0,L)`) **independently**
(confirm Ableton allows loop brace < content extent — standard, verify).
- **Delay/wrap clips → 2 cycles.** `[0,L)` = clean first pass (NO wrapped-in notes; delay tails
  spill forward past L). `[L,2L)` = seamless wrapped steady-state (incoming tail at its start + own
  tail wrapped). Default brace `[0,L)` = "unwrapped"; user moves brace to `[L,2L)` = "wrapped". So
  wrap engages only from the 2nd cycle (existing bake's `wrap && loop==loops-1` is close but the
  layout — keep cycle-1 forward-spilled, cycle-2 wrapped, content=2L, brace=L — is export-specific,
  not a plain `bake(loops=2,wrap=1)` which wraps to full length).
- **Randomized clips → 4 cycles.** 4 distinct random passes linear in `[0,4L)` (fresh walk each),
  content=4L, default brace `[0,L)`. User expands brace for more variety before repeat.
- **Random + delay together → BOTH, layered** (user 2026-05-23): 4 cycles total; cycle 1 = clean
  unwrapped pass; cycles 2–4 = each a fresh random variation AND wrapped (seamless). Default brace
  = cycle 1; expanding gives more variety + the wrapped steady-state.
- **Drums → same model as melodic** (user 2026-05-23): a drum clip's "L" = one full realign cycle
  (the LCM where all lanes line back up); default brace = that one cycle; variety/wrap extras baked
  *after* it, identical to melodic.
- Non-random, non-delay clips → 1 cycle, region = loop = L (normal).

## Finalized UX/product decisions (2026-05-23 walkthrough)
1. **Output:** write to `/data/UserData/schwung/davebox-exports/` (persistent sibling — survives
   module updates). Filename `<set-name>-YYYYMMDD.ablbundle`; same-day duplicate → append `-2`,`-3`.
   Retrieval via SFTP. (No in-UI download for v1.)
2. **Scope:** ALWAYS export all 8 tracks (empty tracks get a Dummy Drift). Empty clips → empty slots.
3. **Samples:** PORTABLE — resolve every `sampleUri` to its file (CoreLibrary/UserLibrary roots) and
   embed in `Samples/`; rewrite refs relative. Fully self-contained.
4. **Naming:** set name inside bundle = dAVEBOx set name. Track names by route: Move → Move preset
   name; Schwung → `SCH-[chain name]`; External → `Ext ch [n]` (n = MIDI send channel); no-route
   fallback → `dB [tr]` (track #).
5. **Bake:** fully automatic, "loop-brace reveals extra content" (see bake-options section). Auto per
   clip/lane from its pfx. Delay→2 cycles (1 clean/unwrapped, 2 wrapped); Random→4 cycles; Both→4
   cycles (cycle1 clean, 2–4 random+wrapped); Drums→same, L = one LCM realign cycle; plain→1 cycle.
   Default loop brace = first cycle (L); extras baked after, user expands brace in Ableton.
6. **Layout:** tracks×scenes grid, dAVEBOx clip N → scene N (16 scenes). Clips land **stopped**
   (launch individually in Live). "Scenes" are just slot rows, not musically-coherent rows.

## Status (2026-05-23)
Feasibility CONFIRMED end-to-end. **All device-gated data unknowns resolved:**
- 8×16 bundle opens in Live ✅ · packaging (Song.abl@root + Samples/) ✅ · JSON authoring ✅
- sample bundling: URI→file resolution mapped (CoreLibrary / UserLibrary) ✅
- Dummy Drift instrument template captured ✅
- channel→instrument mapping data available (`midiInputMode`) ✅
- baked/heard MIDI via existing `bake_clip` ✅

**Remaining is implementation + a couple of design points (no longer blocked on unknowns):**
1. **On-device ZIP** — `.ablbundle` is a zip; host has no zip API. Options: hand-rolled
   store-mode (uncompressed) zip writer in JS (~100 lines; Live accepts stored zips), or a small
   on-device helper. **Decision pending.**
2. **Non-destructive render** — `bake_clip`/`bake_drum_lane` write baked notes INTO the clip
   (mutate session, w/ undo); export must not commit. Add a DSP render-to-buffer that runs the
   existing pfx compute (lines before the write-back) and emits notes via `get_param` — no
   `clip_init`/`clip_insert_note`/undo. Melodic: render to clip length. **Drums: render to LCM of
   lane lengths (in ticks) + tile + merge lanes — new logic, see "Drum clips" section + cap policy.**
3. **Channel-map resolution detail** — pin how dAVEBOx `trackChannel`/`trackSchwungSlot` index into
   Move `midiInputMode` / Schwung `slot_channels` (the `patches`[1-4] vs `slot_channels`[4-7] offset).
4. **JS export module** (`ui/ui_export.mjs`): orchestrate — gather session, bake+read notes
   (tick→beat ÷96), read Move `Song.abl` + Schwung `shadow_chain_config.json`, build mapping, copy
   instrument subtrees + resolve/copy samples, inject Dummy Drift for unmapped tracks, name
   SCH-[chain]/Move-preset, assemble 8×16 `Song.abl`, write bundle. Menu entry in `buildGlobalMenuItems`.
5. **Output location** — where the `.ablbundle` lands for the user to retrieve (set folder / a known
   path grabbed via move.local web or SFTP).
Caveats unchanged: Drum Racks need Live 12.1+; export one-way.

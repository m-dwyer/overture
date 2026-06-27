# Device Smoke Checklist — the irreducible on-device pass

**Purpose.** Everything that *can* be verified headlessly is summarized in
[`COVERAGE-GAP-MAP.md`](COVERAGE-GAP-MAP.md). This file is the **complement**:
the short, ordered list of things that are
device-only *by nature* and can't be faked in the wasm/Node harness. A device
trip should be this 5-minute pass — not a full re-test.

**When to run it.** After any change that touches: DSP audio/voices, the bundle
(QuickJS surface), Schwung host integration (co-run, set_param delivery),
hardware I/O (LED/OLED/palette/MIDI), or the export packager. Pure host-side JS
logic with green `mise run verify` does **not** need this.

**Deploy reminder.** Use `mise run deploy` to build and install the active tool
package. JS changes need a full reboot, not just Back/Shift+Back (`init()`
re-runs in the same runtime). See `AGENTS.md` → Session workflow. Check
`seq8-pad-drop.log` and `seq8-jserr.log` first thing.

---

## Why each item is here (can't be headless)

| Seam | Why the harness can't catch it |
|---|---|
| Real audio | No DAC in Node; metronome/voice release/echo are acoustic. |
| OLED / LED / palette | Recorder sinks capture `print()`/`setLED` *calls*, not pixels or SysEx on the wire. |
| QuickJS vs V8 | vitest runs V8; the bundle's QuickJS parse gate catches syntax, not runtime divergence. |
| Schwung host | Emulator stubs the host — coalescing, silent-drop of new global keys, co-run SHM are all faked. |
| p-lock playback emission | wasm DSP keeps state internally + has no real MIDI bus; the cable-0 encoder-CC output only exists on hardware. |
| Engine state roundtrip | wasm `save`/`state_load` use an in-memory buffer, not `seq8-state.json`; the device proves the real file path. |
| Export packager | `host_system_cmd` (python packager) isn't in the emulator. |

---

## The pass (ordered)

Run top-to-bottom; each step leaves the device in a good state for the next.

### 1. Boot & render
- [ ] **Launch Overture.** OLED shows the splash, then the main Track View; LEDs light (pads + track row). → *No blank OLED, no LED corruption, no `seq8-jserr.log` growth.*
- [ ] Confirm `seq8-pad-drop.log` is empty after ~30 s of playback.

### 2. Real audio (the class of bug headless tests miss)
- [ ] **Metronome.** Global menu (Shift+Menu) → Metro = Play, start transport → **you hear the click.** → *Audible, on-beat. (A wrong on-device path compiles + passes all headless tests but is silent.)*
- [ ] **Voice release.** Play a melodic clip, stop → **notes release** (no stuck/ringing voices). → *`pfx_send` voice-off actually reaches the synth.*
- [ ] **External MIDI / ROUTE_MOVE.** If using a track routed to Move with external in: confirm **no echo cascade / crash** (cable-2 re-injection). → *ROUTE_SCHWUNG vs ROUTE_MOVE behaves per `AGENTS.md`.*

### 3. Hardware I/O
- [ ] **Pads & encoders.** Play pads (notes 68–99), turn the 8 knobs, jog wheel, step buttons → **real MIDI reaches the engine** and the UI responds at the ~94 Hz tick. → *No dropped input, no lag spikes (RT scheduling).*
- [ ] **Palette / LED color.** Switch banks and tracks → **button + pad LED colors update correctly** (palette SysEx on the wire), including after a `reapplyPalette` (no stale/dropped colors).

### 4. AUTO/CC p-locks — the novel path (edit is headless-proven; **emission is not**)
- [ ] **Playback emission.** On a melodic track, CC PARAM bank (6): set a knob's resting value, then hold a step + turn to write a per-step point. Assign that knob to a CC the Move engine responds to. **Start transport → the Move engine param actually moves** (cable-0 encoder-CC reaches the voice). → *This is the irreducible end-to-end proof; the harness only asserts the points are stored (`cc_rest`/`_ccstepinfo`).*
- [ ] **Record-while-playing.** Arm Rec, play, turn a CC knob → automation records and **plays back** on the next loop.

### 5. Persistence — engine state roundtrip (edit/orchestration is headless-proven)
- [ ] **Save/resume.** Make edits (notes + p-locks), Shift+Back to suspend, relaunch → **the set restores exactly** (notes, p-locks, sidecar UI state). → *Proves the real `seq8-state.json` write + `state_load`, which the wasm harness can't (it keeps state in-memory).*
- [ ] **Snapshots.** Global menu → Save state, edit, → Load state → **engine reverts** to the snapshot. → *Headless proves the manifest/file orchestration; the device proves the engine actually reloads.*
- [ ] **Clear Session.** Global menu → Clear Sess → Yes → **session resets** and survives relaunch.

### 6. Export
- [ ] **Export to Ableton.** Transport stopped, Global menu → Export to Ableton → Yes → **the packager runs** (EXPORTING… → done) and produces a loadable `.ablbundle`. → *`host_system_cmd` + python packager; headless only covers the request→confirm→arm.*

### 7. Schwung host integration
- [ ] **Co-run.** Enter Move/Schwung co-run, edit a sound, exit → **clean handoff** (OLED returns to Overture, no desync). → *SHM/`shadow_corun_*` are stubbed headless.*
- [ ] **New global set_param keys.** If this change added any *new* global (non-`tN_`) set_param key: confirm it reaches DSP with a one-line `seq8_ilog` — the host **silently drops** new global keys (see `AGENTS.md` → Critical constraints).

### 8. QuickJS
- [ ] The bundle parse gate (`bundle_ui.sh`) passed at build, but **exercise any new/changed JS path once on device** — QuickJS runtime behavior (not syntax) can still diverge from V8.

---

*Keep this list short.* If an item here becomes reliably headless-testable
(e.g. a future DSP host-file bridge unlocks the engine state roundtrip), move it
out of this file and into the behavior tier.

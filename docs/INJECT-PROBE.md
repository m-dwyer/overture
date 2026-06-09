# Inject Probe — the reusable JS injection harness

`schwung/src/modules/tools/inject-probe/` — a **pure-JS**, parametric MIDI-injection
probe for mapping Move's live engine/control seams. It replaces the slow DSP loop of the older
`engine-probe`: there's **no `dsp.so`, no docker, no aarch64 cross-compile**. Inject runs straight
from `ui.js` via the host's `move_midi_inject_to_move()` global, so the dev loop is just:

```
edit ui.js → repackage (instant) → reopen the tool on device
```

## Why this exists
The injection seam (writing 4-byte USB-MIDI packets into MoveOriginal's MIDI_IN mailbox) is the only
way to drive Move's real engines live. We were iterating it via a C DSP that needed a Docker cross-
compile every change — minutes per cycle. `move_midi_inject_to_move([b0,status,d1,d2])` exposes the
exact same inject path to JS (proven: `song-mode` plays Move tracks through it), so the probe is now JS.

## The injection model (the reusable core)
`move_midi_inject_to_move([b0, status, d1, d2, …])` — one or more 4-byte packets. `b0 = (cable<<4)|CIN`
(CIN = `status>>4`). The **cable nibble** picks how Move routes it:

| Cable | Route | What reaches the engine |
|---|---|---|
| **0** | internal hardware (pads/buttons/knobs) | encoder CCs move device params (positional p-locks); **CC79** = master Volume encoder; **CC40..43** = track buttons (reversed: CC43=Trk1); **note 8** = Volume-knob touch |
| **2** | external USB MIDI → track by channel | notes / velocity / **poly-AT** reach the voice; **plain CC does NOT** (§4.1.3, measured flat) |

Pass several packets in one array to fire a gesture atomically.

The helper functions at the top of `ui.js` (`injMsg`, `ccMsg`, `noteOn/Off`, `encByte`) are the bits
worth copying into any future probe. `encByte()` encodes Move's relative-encoder deltas
(+1..63 → 1..63, −1..−63 → 127..65).

## Controls
- **K1** cable · **K2** type (Note/CC/PolyAT/ChanAT/Bend) · **K3** channel
- **K4** data1 (note/cc#, Shift = ±10) · **K5** data2 (value, Shift = ±10)
- **K6** pattern · **K7** rate (ticks/event)
- **Play** — OneShot: fire once · Flip/Ramp/Hold: start/stop
- **Step 16** — toggle the canned **TrkVol gesture** (hold Track + Volume-touch + ramp CC79; track = channel 1..4)
- Configure **while stopped** (knob edits are ignored during an active drive).

**Patterns:** `OneShot` (one message on Play) · `Flip` (toggle value 0↔127 every `rate` ticks — the
"what responds" stark test) · `Ramp` (relative-encoder ±2 sweep, reversing — p-locks / encoders) ·
`Hold` (assert once, release on stop — notes / buttons).

Repaints every tick, so it survives the suspend→resume cycle (the host restores callbacks on resume
but doesn't re-trigger a draw — an as-needed redraw would leave the screen blank; that bit us during
the engine-probe work).

## Deploy
```
cd schwung
mkdir -p build/pkg/inject-probe && cp src/modules/tools/inject-probe/{module.json,ui.js} build/pkg/inject-probe/
COPYFILE_DISABLE=1 tar czf build/inject-probe-module.tar.gz -C build/pkg inject-probe
./scripts/install.sh install-module ./build/inject-probe-module.tar.gz --host=move-em.local --skip-confirmation
```
On device: open **Tools → Inject Probe**. Plain **Back** = suspend + keep injecting (return to Move to
watch); **Shift + Back** = fully unload (needed before a redeploy takes effect, else the suspended
instance is resumed instead of reloaded).

## Findings captured so far (per-track volume wedge, #4)
See `WEDGE-EXPERIMENT.md` / memory `move-live-engine-seams`. Summary:
- track CC7 (cable 2) → **flat** (track CC unsupported, §4.1.3).
- CC79 + hold-track (cable 0) → moves Move's track-volume overlay **but CC79 is the master encoder, so
  it bleeds into master** — not a clean per-track control. Needs Move foreground (the overtake shim
  filters the track-button CC while Overture's UI is up), so it can't be driven cleanly from inside Overture.
- D-Bus → Move exposes no mixer/volume **set** method (only a read-only ScreenReader "Track Volume" announcement).
- **Conclusion:** per-track volume on Move's engine tracks has no clean injection/IPC route; the only
  in-Overture path is scaling the track in Schwung's audio composite (`chain_slots[t].volume`, Link-Audio
  rebuild) — a future build, and Schwung's mix gain, not Move's fader. This is why dAVEBOx left #4 out.

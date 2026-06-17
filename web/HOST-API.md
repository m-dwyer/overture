# Overture Emulator — Host-API contract (derived from the real tool)

The emulator runs the **real** dAVEBOx/Overture `ui.js` (and shared Schwung modules)
against a browser mock of the Schwung `shadow_ui` host. This file pins the exact
contract, extracted from `overture-ui/ui/*` and `schwung/src/shared/*`. Keep it in sync.

## Entry points (host → tool)
The tool registers these on `globalThis`; the emulator host loop calls them:

| Global | When the host calls it |
|---|---|
| `init()` | once, after the runtime + host API are ready |
| `tick()` | ~94 Hz steady loop (device cadence; see `STEP_HOLD_TICKS`) |
| `onMidiMessageInternal(status, d1, d2)` | MIDI from Schwung chain / internal |
| `onMidiMessageExternal(status, d1, d2)` | MIDI from USB / external |

Also probed via `globalThis`: `shadow_get_ui_flags()` (co-run/feature flags).

## Host shims (tool → host) — the mock surface
Call counts are from a static scan of `ui/*` (rough frequency → priority):

**Params (DSP bridge)** — route to the DSP (layout-tier: JS mock; behavior-tier: seq8-wasm)
- `host_module_set_param(key, val)`  (438)
- `host_module_get_param(key) -> string|null`  (192) — **returns null when absent**

**Display (128×64 1-bit OLED → canvas)**
- `clear_screen()`  (24)
- `fill_rect(x, y, w, h, on)`  (206)
- `print(x, y, text, ...)`  (193) — text primitive (font in `assets/fonts/mcufont.h`)
- `host_flush_display()`  (2) — present the frame
- (confirm during bring-up: any `draw_rect`/`set_pixel`/`draw_line`/`draw_text` variants)

**LEDs (pads/steps/buttons → grid render)**
- `setLED(idx, color)`  (44)
- `setButtonLED(cc, color, force?)`  (52) — `force` re-asserts past `input_filter` buttonCache
- `clearAllLEDs()`  (6)

**State persistence**
- `host_write_file(path, data)`  (30) → MEMFS / localStorage
- `host_read_file(path) -> string|null`  (27)

**MIDI out**
- `move_midi_inject_to_move([type,status,d1,d2])`  (18) — cable-routed inject to Move tracks
- `shadow_send_midi_to_dsp(...)`  (3) — shares the set_param delivery channel (coalesces!)

**co-run (native-editor delegation)** — layout-tier: stub editor view
- `shadow_corun_begin(target, id, keep_mask)`
- `shadow_corun_end()`
- `shadow_corun_state() -> { target, id, keep_mask } | null`

## Gotchas to replicate (they shape UX; see tool CLAUDE.md)
- **Coalescing:** only the LAST `set_param` per audio buffer reaches DSP; `shadow_send_midi_to_dsp`
  shares that channel. In `onMidiMessage`, if both fire, the set_param is lost.
- **`host_module_get_param` from `onMidiMessage` returns null** — only valid in tick/render.
- **LED per-tick budget:** later writes in a tick can drop; don't write one LED from two paths.
- **Step writes are two-tick deferred** (`_toggle` / `_set_notes`): activate on tick N, notes N+1.

## Module resolution
The tool's `ui.js` imports by absolute on-device paths. The emulator remaps (Vite plugin):
- `/data/UserData/schwung/shared/*`            → `schwung/src/shared/*`  (7+ modules, transitive)
- `/data/UserData/schwung/modules/tools/overture/*` → `overture-ui/ui/*`

This loads the dev sources directly (HMR), so no `bundle_ui.py` step is needed for the emulator.

## Fidelity ladder
1. **Layout tier** (start): real UI JS + JS-mock DSP (`src/mock-dsp.js`) — enough clip/step/playhead
   state to design modes, the motion lane, the co-run zoom gesture.
2. **Behavior tier**: real UI JS + real `seq8`-wasm (`overture-ui/dist/wasm/seq8.{js,wasm}`, built by
   `overture-ui/scripts/build-wasm.sh`). The wasm flat ABI: `seq8_boot/create/on_midi/set_param/get_param/
   render/set_bpm/destroy` (see `overture-ui/dsp/seq8_wasm_glue.c`). Swap the mock for a wasm-backed
   `host_module_*` adapter.

# Overture — Emulator (UX dev harness)

A browser harness that runs Overture's **real UI** (and, later, real DSP) against a **mock of the
Schwung host + Move hardware**, so UX iterates in seconds instead of build→deploy→device. Lives in
`overture/web/`. It is the first design loop for Overture-native UX work.

## Why this, not the real stack
The real stack can't run locally: **MoveOriginal is a closed aarch64 binary bound to the SPI
hardware** — no port, no emulation. But dAVEBOx/Overture is cleanly split (DSP in C, UI in JS, talking
through a defined host API), so we run *our* code against a *mock* of that boundary.

## Real vs mocked
| Layer | In the emulator |
|---|---|
| Tool **UI JS** (`overture-next/ui/ui.js` + `overture-next/src`) | **REAL** — the current replacement scaffold |
| Tool **DSP** | **mocked/stubbed**; the active tool has no DSP/WASM build yet |
| Schwung **modules** | **REAL** WASM from the pinned Moveforge submodule |
| **Display** (OLED) | MOCK → draw 128×64 to an HTML canvas (`clear_screen`/`print`/`draw_rect`/…) |
| **Pads/steps/knobs/jog/buttons** | MOCK → clickable Move shell → emits the right MIDI into `onMidiMessageInternal` |
| **LEDs** | MOCK → render pad/step colors from `setLED` |
| `get_param`/`set_param` | MOCK → route to the DSP instance (wasm or stub) |
| **Move's Ableton engines / MIDI inject** | MOCK/stub (placeholder + local synth or silence) |
| **co-run** (Move device UI / Schwung chain editor) | MOCK → a stub "editor" view; design the *transition*, not the native editor |

**Net:** UI + tool logic are real; only the host/hardware/Move-engine boundary is faked — the right
fidelity for UX design.

## Fidelity ladder (start cheap)
1. **Layout tier** — real UI JS + **JS-mock DSP** (just enough clip/step/playhead state). Enough to
   design modes, navigation, the motion lane, the co-run "zoom" gesture. *Start here.*
2. **Behavior tier** — add this deliberately when Overture owns a current
   DSP/WASM target.

## Host-API shim list (the mock surface)
Mirror Schwung's `shadow_ui` JS API (confirm against `schwung/docs/API.md`). Representative set:
- **Lifecycle:** `init`, `tick` (~94 Hz), `onMidiMessageInternal`, `onMidiMessageExternal`.
- **Display:** `clear_screen`, `print`, `draw_rect`, `fill_rect`, `host_flush_display` → canvas.
- **LEDs:** `setLED`, `setButtonLED`, `clearAllLEDs` → pad/step grid render (mind the per-tick budget).
- **Params:** `host_module_get_param`, `host_module_set_param` → DSP routing.
- **MIDI:** `move_midi_inject_to_move([type,status,d1,d2])`, `host_module_send_midi`,
  `shadow_send_midi_to_dsp` → stub/log/local synth.
- **co-run:** `shadow_corun_begin/end/state` (+ the gated `typeof` checks) → stub editor view.

> Replicate the *gotchas* that shape UX where cheap: input coalescing,
> `get_param`-null-from-onMidi, and the LED per-tick budget. They affect
> interaction design, so the mock should behave like the host, not idealised.

## Moveforge Module Assets
Overture pins Moveforge as a submodule under `moveforge/`. The emulator serves
module metadata from `moveforge/src/modules/` and browser module WASM from
`moveforge/web/wasm/`.

```sh
mise run moveforge-wasm
```

That task initializes the submodule and builds the WASM modules required by the
browser Schwung chain. `mise run dev`, `mise run web-build`, and
`mise run build` depend on it.

Moveforge's emulator also provides useful reference material to copy/adapt:
- the **Move hardware shell** (track/mode buttons, 8 encoders, wheel, transport, 16 steps, 32 pads),
- the **OLED canvas**,
- the **wasm-DSP loader** + AudioWorklet path (for module audition),
- the **pad-layout engine** (chromatic / in-key / fourths), input/event plumbing.
moveforge's emulator is *module-focused*; Overture's hosts the **tool** + renders the **real OLED UI**.

## What it can't validate (device-only — don't over-trust)
Real Ableton-engine sound, the motion effect on real engines, device timing/coalescing/jitter, inject
latency, latency parity, co-run's real behavior, and the exact LED budget. Use the emulator first;
confirm those items on device when they matter to the change under test.

## Build / run
The emulator lives in `web/`, but Vite remaps the tool's on-device imports to
the live replacement tool entrypoint in `overture-next/ui/`.

Common loop:

```sh
# From the overture repo root.
mise run dev
```

Packaged builds keep the two active targets explicit:

```sh
mise run tool-build  # build the active Schwung tool package from overture-next/
mise run build       # tool package + Moveforge module WASM + web emulator
```

The native Move package is built from `overture-next/` and does not currently
produce a `dsp.so` or Overture-owned WASM artifact. Moveforge module WASM is a
separate emulator dependency.

Then open the Vite URL, normally `http://localhost:5173/`. Edit
`overture-next/src/*`, `overture-next/ui/*`, or `web/src/*`; Vite reloads
without bundling or installing on the device.

Checks:

```sh
pnpm typecheck
pnpm verify
pnpm -C web test:e2e
```

Use `pnpm -C web dev` for UI/UX iteration, `pnpm verify` for the current
Overture ratchet, and `pnpm -C web test:e2e` for browser smoke/input coverage.

Only compile/install to the Move after the browser path proves the interaction
or when the phase needs real engine sound, co-run timing, MIDI injection, or
LED-budget confirmation.

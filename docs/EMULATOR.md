# Overture — Emulator (UX dev harness)

A browser harness that runs Overture's **real UI** (and, later, real DSP) against a **mock of the
Schwung host + Move hardware**, so UX iterates in seconds instead of build→deploy→device. Lives in
`overture/web/`. It is the first design loop for Overture-native UX work in `ROADMAP.md`.

## Why this, not the real stack
The real stack can't run locally: **MoveOriginal is a closed aarch64 binary bound to the SPI
hardware** — no port, no emulation. But dAVEBOx/Overture is cleanly split (DSP in C, UI in JS, talking
through a defined host API), so we run *our* code against a *mock* of that boundary.

## Real vs mocked
| Layer | In the emulator |
|---|---|
| Tool **UI JS** (`ui/*.mjs`) | **REAL** — exactly what ships |
| Tool **DSP** (`seq8.c`) | **REAL** at behavior-tier (emscripten → wasm); **mocked** (JS stub) at layout-tier |
| Schwung **modules** | **REAL** wasm (moveforge already compiles these) |
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
2. **Behavior tier** — real UI JS + **real `seq8`-wasm**. This is the default test path for behavior
   that touches sequencing, routing, automation, or persistence.

## Host-API shim list (the mock surface)
Mirror Schwung's `shadow_ui` JS API (confirm against `schwung/docs/API.md`). Representative set:
- **Lifecycle:** `init`, `tick` (~94 Hz), `onMidiMessageInternal`, `onMidiMessageExternal`.
- **Display:** `clear_screen`, `print`, `draw_rect`, `fill_rect`, `host_flush_display` → canvas.
- **LEDs:** `setLED`, `setButtonLED`, `clearAllLEDs` → pad/step grid render (mind the per-tick budget).
- **Params:** `host_module_get_param`, `host_module_set_param` → DSP routing.
- **MIDI:** `move_midi_inject_to_move([type,status,d1,d2])`, `host_module_send_midi`,
  `shadow_send_midi_to_dsp` → stub/log/local synth.
- **co-run:** `shadow_corun_begin/end/state` (+ the gated `typeof` checks) → stub editor view.

> Replicate the *gotchas* that shape UX where cheap: input coalescing, `get_param`-null-from-onMidi,
> the LED per-tick budget (see `HYBRID-GROOVEBOX.md` / dAVEBOx limitations). They affect interaction
> design, so the mock should behave like the host, not idealised.

## Reuse from moveforge (don't absorb it)
moveforge's emulator already provides — copy/adapt these (your repo, free), keep moveforge independent:
- the **Move hardware shell** (track/mode buttons, 8 encoders, wheel, transport, 16 steps, 32 pads),
- the **OLED canvas**,
- the **wasm-DSP loader** + AudioWorklet path (for module audition),
- the **pad-layout engine** (chromatic / in-key / fourths), input/event plumbing.
moveforge's emulator is *module-focused*; Overture's hosts the **tool** + renders the **real OLED UI**.

## What it can't validate (device-only — don't over-trust)
Real Ableton-engine sound, the motion effect on real engines, device timing/coalescing/jitter, inject
latency, latency parity, co-run's real behavior, and the exact LED budget. Use the emulator first;
confirm those items on device for the relevant `ROADMAP.md` phase.

## Build / run
Reuse moveforge's Vite + wasm toolchain. Target: `mise run dev` (or equivalent) → browser at a local
port; watches `tool/ui/*` and rebuilds. Behavior-tier additionally builds `seq8` → wasm.

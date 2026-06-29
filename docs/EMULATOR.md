# Overture — Emulator (UX dev harness)

A browser harness that runs Overture's **real UI** against a **mock of the
Schwung host + Move hardware**. It lives in `web/` and is the first design loop
for Overture work.

## Why this, not the real stack
MoveOriginal is a closed aarch64 binary bound to hardware. The emulator runs the
active Overture UI and core against browser implementations of the display, LED,
MIDI, file, and Schwung-chain host surfaces.

## Real vs mocked
| Layer | In the emulator |
|---|---|
| Tool **UI JS** (`overture-next/ui/ui.js` + `overture-next/src`) | **REAL** — the current replacement scaffold |
| Tool **DSP** | **mocked/stubbed**; the active tool has no DSP/WASM build yet |
| Schwung **modules** | **REAL** WASM from the pinned Moveforge submodule |
| **Display** (OLED) | MOCK → draw 128×64 to an HTML canvas (`clear_screen`/`print`/`draw_rect`/…) |
| **Pads/steps/knobs/jog/buttons** | MOCK → clickable Move shell → emits the right MIDI into `onMidiMessageInternal` |
| **LEDs** | MOCK → render pad/step colors from `setLED` |
| `get_param`/`set_param` | MOCK -> route to the Overture mock DSP surface |
| **Move's Ableton engines / MIDI inject** | MOCK/stub → routed to the `sendToMove` MIDI sink and logged in the browser |
| **co-run** (Move device UI / Schwung chain editor) | MOCK → a stub "editor" view; design the *transition*, not the native editor |
| **OVT console/test harness** | HOST PORT → publishes a browser-only handle for deterministic MIDI injection and tick advancement |

**Net:** UI + tool logic are real; only the host/hardware/Move-engine boundary is faked — the right
fidelity for UX design.

## Fidelity ladder (start cheap)
1. **Layout tier** — real UI JS + **JS-mock DSP**. Enough to design modes,
   navigation, routing, and sequencing flow. Start here.
2. **Behavior tier** — add this deliberately when Overture owns a current
   DSP/WASM target.

## Host-API shim list (the mock surface)
Mirror Schwung's `shadow_ui` JS API (confirm against `schwung/docs/API.md`). Representative set:
- **Lifecycle:** `init`, `tick` (~94 Hz), `onMidiMessageInternal`, `onMidiMessageExternal`.
- **Display:** `clear_screen`, `print`, `draw_rect`, `fill_rect`, `host_flush_display` → canvas.
- **LEDs:** `setLED`, `setButtonLED`, `clearAllLEDs` → pad/step grid render (mind the per-tick budget).
- **Params:** `host_module_get_param`, `host_module_set_param` -> mock DSP routing.
- **MIDI:** `move_midi_inject_to_move([type,status,d1,d2])` → `sendToMove`;
  `shadow_send_midi_to_dsp` → `sendToSchwungChain` and the browser Schwung chain.
- **co-run:** `shadow_corun_begin/end/state` (+ the gated `typeof` checks) → stub editor view.
- **Browser composition:** `web/src/host/browser-emulator-harness.ts` owns
  the browser host port bundle, browser/manual Schwung chain selection, the
  real Overture tool boot, tick-loop lifecycle, initial state scheduling, and
  the shell's inbound MIDI send boundary.
- **Host globals:** `web/src/host/emulator.ts` loads the real tool UI after
  `web/src/host/shadow-ui-host-runtime.ts` installs the `shadow_ui` host
  globals. The tool calls these APIs as bare globals on device, so the emulator
  still installs them on `globalThis`; the mutation is isolated behind
  `installGlobals(...)` and can target another object in tests.
- **Schwung host runtime:** `web/src/host/schwung-host-runtime.ts` owns browser
  Schwung chain creation/fallback and exposes the Schwung-specific host API
  shim used by the broader host runtime.
- **Harness:** `web/src/host/emulator-harness.ts` publishes `globalThis.OVT`
  from a browser-only harness port; Overture itself does not depend on it.

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
browser Schwung chain. `mise run web-dev`, `mise run web-build`, and
`mise run build` depend on it.

## What it can't validate (device-only — don't over-trust)
Real Move-engine sound, device timing/coalescing/jitter, physical MIDI injection
latency, co-run's real behavior, and the exact LED budget. Use the emulator
first; confirm these on device when they matter to the change under test.

## Build / run
The emulator lives in `web/`, but Vite remaps the tool's on-device imports to
the live replacement tool entrypoint in `overture-next/ui/`.

Common loop:

```sh
# From the overture repo root.
mise run web-dev
```

Packaged builds keep the two active targets explicit:

```sh
mise run tool-build  # build the active Schwung tool package from overture-next/
mise run tool-deploy # deploy the active tool package to an existing Schwung Move
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
pnpm verify
mise run web-e2e
```

Use `mise run web-dev` for UI iteration, `pnpm verify` for the current Overture
ratchet, and `mise run web-e2e` for browser smoke/input coverage.

Only compile/install to the Move after the browser path proves the interaction
or when the phase needs real engine sound, co-run timing, MIDI injection, or
LED-budget confirmation.

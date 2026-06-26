# Schwung Adapter + Move-App Core Plan

Status: planning spike on `plan/schwung-adapter-move-app`.

Current implementation direction: keep `overture-ui` intact as the reference
implementation, and wire the browser emulator directly to a new `overture-next`
tool scaffold. Do not add runtime tool selection yet; the emulator should be the
fast iteration target for the replacement.

This plan evaluates replacing the inherited dAVEBOx-derived tool internals with
a smaller Overture core based on `~/src/move-spike/move-app`, while still
running as a Schwung augment layer so MoveOriginal stays alive and Ableton's
real engines remain available.

## Decision Frame

The question is not "dAVEBOx fork or no Ableton engines". The viable third path
is:

- keep MoveOriginal running under Schwung;
- keep Schwung as the host/injection/mixing layer;
- build Overture's sequencer and UI model from a clean core;
- expose Schwung through a narrow adapter instead of inheriting dAVEBOx's
  `seq8` UI/DSP state machine.

The current `move-app` direct-SPI backend remains valuable for standalone
experiments, but it cannot be the hybrid runtime because it kills MoveOriginal
to own `/dev/ablspi0.0`. The hybrid runtime needs a Schwung tool/overtake
adapter.

## Current Assets

### `move-app`

Useful foundation:

- `src/io.h`: small backend seam for audio, MIDI, display, and lifecycle.
- `src/io_jack.c`: local JACK backend for Mac iteration.
- `src/io_ablspi.c`: direct-SPI backend for standalone hardware ownership.
- `src/dsp_host.c`: moveforge/Schwung `.so` module hosting proof.
- `src/display.c`: 128x64 1-bit framebuffer drawing.
- `Makefile`: local, device, direct-SPI, preview, and golden-render flows.
- `docs/GROOVEBOX.md`: phased standalone groovebox plan.

Prototype limitations:

- `src/app.c` is still a single prototype module mixing input, audio, display,
  LED state, placeholder synth, logging, and offline render.
- The direct-SPI runtime is the wrong runtime for hybrid Overture.
- The UI primitives are C framebuffer functions, while Schwung tool UI runs in
  QuickJS unless we add a framebuffer bridge.

### `overture-ui`

Useful foundation:

- Proven Move-engine routing, co-run behavior, persistence patterns, export
  behavior, and many edge-case fixes.
- Existing tests and generated manuals capture a large behavioral surface.
- Reusable UI ideas in `ui/components/`, especially parameter pages, browser
  rows, confirm prompts, and status flashes.

Cost:

- Global UI state is widely visible.
- UI/DSP communication is stringly typed and timing-sensitive.
- Host coalescing and delayed readback policy leak into many workflows.
- The inherited `seq8` DSP/state model is hard to reason about and socially
  tied to dAVEBOx lineage.

## Target Architecture

```
MoveOriginal
  owns Ableton engines and SPI
        ^
Schwung shim / shadow host
  injects MIDI, owns tool lifecycle, hosts Schwung slots, handles co-run
        ^
Overture tool module
  JS shell: input, OLED/LED drawing, menus, host callbacks
  C/DSP core: clock, sequencer, track state, command execution, injection
        ^
Overture core modules
  track model, pattern model, param descriptors, UI view models, persistence
```

The interface between Overture and Schwung should be intentionally small:

- input events from hardware and external MIDI;
- display and LED writes with rate limits made explicit;
- Move-engine injection: cable-2 notes/poly-AT by channel;
- Move parameter injection: cable-0 encoder CC deltas for positional p-locks;
- Schwung slot routing/editing hooks;
- state file read/write;
- co-run begin/end/state;
- tempo/transport queries only where proven reliable.

## Proposed Module Interfaces

### `overture_core`

Owns product behavior independent of Schwung:

- tracks, clips/patterns, scenes, transport, clock, record state;
- commands such as step toggle, note record, clip launch, track select;
- per-track route kind: Move, Schwung slot, external, later standalone hosted;
- read-only view models for OLED/LED rendering;
- serialization format and migrations.

The test surface is this module's interface. Tests should not need QuickJS,
Move hardware, Schwung, WASM, or audio.

### `schwung_adapter`

Owns host facts and ugly details:

- converts core output events to `move_midi_inject_to_move` packets;
- queues injection under Schwung's packet/tick limits;
- owns the cable-0/cable-2 distinction;
- owns host capability gates;
- owns co-run lifecycle calls;
- hides `host_module_set_param` / `host_module_get_param` string keys.

The core never calls Schwung globals directly.

### `ui_shell`

Owns the QuickJS tool module surface:

- `globalThis.init`;
- `globalThis.tick`;
- `globalThis.onMidiMessageInternal`;
- `globalThis.onMidiMessageExternal`;
- `globalThis.onUnload`;
- input normalization into core commands;
- rendering view models from the core to Schwung drawing primitives.

The shell should stay shallow and replaceable.

## Runtime Strategy

Start as a Schwung interactive tool:

- `component_type: "tool"`;
- `tool_config.interactive: true`;
- `tool_config.skip_file_browser: true`;
- `tool_config.overtake: true`;
- `capabilities.suspend_keeps_js: true`;
- `capabilities.claims_master_knob: true`;
- keep `button_passthrough` minimal and explicit.

Prefer a tool module over a standalone process for the hybrid path because the
useful host APIs exist inside the Schwung tool/plugin context. A sidecar native
process would need a new IPC bridge before it could inject MIDI or interact with
co-run safely.

## Phases

### Phase 0: Evidence and Contracts

Goal: prove the adapter shape without committing to a rewrite.

- Write down the exact Schwung APIs required for note injection, parameter
  injection, co-run, state files, display, LEDs, and slot routing.
- Identify which APIs are official upstream Schwung and which are fork-only.
- Decide whether the first spike is JS-only or C-DSP-backed.
- Create a minimal fake host for tests.

Done when: a one-page interface contract exists and all assumptions are backed
by Schwung docs or code references.

### Phase 1: Minimal Tool Skeleton

Goal: load a new Overture tool without dAVEBOx code.

- New module directory for an experimental tool.
- Thin JS shell with init/tick/MIDI callbacks.
- Draw a simple track/transport screen.
- Exit/suspend behavior works.
- No sequencer yet.

Done when: it launches from Schwung, draws reliably, handles basic controls, and
returns to Move without corrupting LEDs.

### Phase 2: Move-Engine Note Injection

Goal: sequence one Move track from the clean core.

- Implement a tiny core clock and one pattern.
- Route note on/off to Move via cable-2 injection.
- Respect Schwung's packet/tick limits.
- Add note-off safety and panic for active notes.
- Verify live on hardware.

Done when: one programmed pattern plays a Move engine while MoveOriginal remains
alive.

### Phase 3: Track Model and UI View Models

Goal: make the clean architecture real before adding features.

- Four Move-routed tracks.
- Track selection.
- Basic clip/pattern model.
- LED and OLED view models generated by the core.
- Unit tests for command behavior and render models.

Done when: the core owns track state and the JS shell mostly renders/dispatches.

### Phase 4: Schwung Slot Tracks

Goal: add open-engine tracks without direct audio hosting.

- Route Schwung tracks through existing Schwung slots first.
- Use slot receive channels and existing chain editor/co-run where possible.
- Keep open-track audio hosted by Schwung, not by Overture core.

Done when: at least one Move track and one Schwung slot track can be sequenced
from the same Overture core.

### Phase 5: Positional Parameter Automation

Goal: add the novel Move-engine p-lock path deliberately.

- Model parameter targets as positional knob slots, not stable parameter IDs.
- Inject cable-0 encoder deltas only when the required Move device page is the
  active target.
- Define degradation behavior when the page is unknown or co-run is unavailable.

Done when: a controlled hardware test sweeps a known Move parameter from the
Overture sequencer and fails closed when the page is not established.

### Phase 6: Persistence and Migration Policy

Goal: avoid inheriting dAVEBOx state debt.

- Define a new Overture state format for the clean core.
- Include versioned migrations from day one.
- Keep dAVEBOx state import optional and explicitly best-effort.

Done when: a set survives suspend/resume/relaunch and incompatible state does
not silently corrupt.

## Reuse Policy

Reuse from `move-app`:

- hardware and backend learnings;
- small C modules after extraction from `app.c`;
- display primitives as design reference;
- golden-render approach for standalone/open-engine tests;
- direct-SPI backend as a separate standalone target, not hybrid runtime.

Reuse from `overture-ui`:

- behavior tests and manual scenarios as acceptance references;
- UI component ideas, ported by concept rather than copied wholesale;
- the Overture-authored boot splash in `ui/render/ui_splash.mjs`;
- co-run entry/exit knowledge;
- exact hardware quirks and Schwung constraints.

Do not reuse:

- `S` global state;
- dAVEBOx `seq8` string-key protocol as the primary interface;
- pending flag sprawl;
- state format unless importing old dAVEBOx sets becomes an explicit feature.

## Risks

- Rebuilding dAVEBOx behavior from scratch is large.
- Schwung tool/DSP APIs may not expose every hook the clean adapter wants.
- Positional parameter automation depends on Move's active UI/page state.
- LED/display ownership bugs can make the product feel unstable quickly.
- A fresh tool could fragment feedback unless lineage and upstream strategy are
  communicated clearly.

## Recommended First Spike

Build the smallest end-to-end hybrid proof:

1. Create an experimental Schwung tool module separate from `overture-ui`.
2. Port only a tiny core: transport, one 16-step pattern, one Move-routed track.
3. Draw a minimal OLED pattern/playhead screen.
4. Inject cable-2 note on/off to Move track 1.
5. Add one testable command module outside QuickJS.
6. Verify on device.

Do not start by porting all of `move-app`, all dAVEBOx behavior, or the public
website. The first spike should answer one question: can a clean Overture core,
hosted through a narrow Schwung adapter, play a real Move engine reliably?

## Open Questions

- Should the first spike be JS-only for speed, or C-DSP-backed to prove the final
  timing model?
- Should the clean core live inside this repo, inside `move-app`, or as a new
  package/submodule?
- Can we use Schwung slots for all open-engine tracks long term, or will Overture
  need its own audio/mix path later?
- Which dAVEBOx behaviors are must-have for a first public Overture build?
- Is dAVEBOx state import required, or is this a clean-break product line?

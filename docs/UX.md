# Overture UX Brief

The UX is the product. The technical substrate is proven enough to focus on
cohesion: Overture should feel like one groovebox, not a collection of Move,
Schwung, and dAVEBOx modes.

Prototype UX in the browser emulator first, then confirm timing, co-run, LED
budget, and real-engine behavior on device.

## Design Principles

1. **Overture-native coherence.** Use Move gestures where they help, but do not
   copy vanilla Move or vanilla dAVEBOx when a different Overture behavior is
   clearer, faster, or easier to learn.
2. **One instrument, not two.** The Ableton/open seam should be invisible during
   play, sequencing, and automation. Surface route differences only when they
   matter for setup, sound editing, or troubleshooting.
3. **Beginner first, power later.** A new user should quickly select tracks,
   launch clips, edit sounds, record notes, and automate. Deeper dAVEBOx power
   should be reachable from the musical object it affects.
4. **Less menu diving.** Menus are for System work and deep settings. Perform
   and Shape actions should live on pads, steps, encoders, Shift+Step, or
   hold-context gestures.
5. **Delegate sound editing.** Move-routed tracks enter Move's native editor via
   co-run. Schwung-routed tracks enter Schwung's chain editor via co-run.
   Overture's own UI stays focused on sequencing, motion, setup, and performance.
6. **Readable feedback beats density.** The OLED and LEDs should always explain
   the current track/clip/context and the next useful action.

## Experience Layers

- **Perform:** play clips, select tracks, mute/solo, record, use variations.
- **Shape:** edit steps, clip length, probability, ratchets, automation/motion.
- **System:** routing, Schwung slots, templates, export, diagnostics, state.

Every feature should have a home in one of these layers. If a feature needs a
menu, ask whether it is really System work or whether a track/clip/step/sound
gesture would be faster.

## Current Vs Target Behavior

| Area | Current behavior | Target behavior |
|---|---|---|
| Track navigation | Side buttons select tracks 1-4; Shift + side selects tracks 5-8. Shift+jog and Shift+bottom-pad remain fallbacks. | Keep side buttons as the primary track model; polish labels and LEDs. |
| Clip selection | Hold a side button to reveal that track's 16 clips on the step buttons; Session View keeps clip performance and clip operations. | Polish reveal LED states and preserve direct performance flow. |
| Sound editing | `Edit Sound...` dispatches to Move-native or Schwung-chain co-run with preflight/failure overlays. | Deepen this into a stable sound-edit module and make return/exit behavior feel seamless. |
| Setup | Route Check shows expected Move/Schwung routes and slot status. | Evolve into Setup Health: version, co-run, slots, channels, template state, and repair guidance. |
| Motion | Param Peek and AUTO lane labels make automation more legible. | Make AUTO feel like musical Motion: lane overview, activity LEDs, and honest target names. |
| Step editing | Hold step + jog edits length; K controls keep the deep editor. | Add fast velocity, transpose, and nudge shortcuts while preserving trig-depth controls. |
| Menus | Global Menu still carries common and deep actions together. | Demote Global Menu to System/deep work; use Shift+Step and context gestures for common actions. |
| Performance | dAVEBOx Performance Mode exists but is conceptually dense. | Reframe as Variations/Perform if that makes the pad behavior easier to understand. |

## Motion Layer

Motion is Overture's unified automation story. Move already has native per-step
parameter automation; Overture wins by making one deeper, readable timeline for
Move engines and Schwung/open tracks.

Targets:

- Touch a knob to see what lane/parameter/context it controls.
- Record motion while playing without leaving the musical flow.
- Edit motion per step or lane where needed.
- Show whether a lane is empty, has motion, is armed, or is currently playing.
- Use actual parameter names only when they come from a reliable source of
  truth. Fall back to honest labels like `Move target`.

## Co-run: Zoom Into Sound

`Edit Sound...` is one command with route-specific internals:

- Move route: enter Move's native device/preset UI.
- Schwung route: enter Schwung's chain editor.
- External route: show route/config status, not a fake editor.

The sequencer should keep running. Overture should return to the same musical
context when co-run exits.

## OLED

The 128x64 OLED should prioritize hierarchy over density. At any moment, it
should answer:

- What track and clip am I on?
- What layer am I in: Perform, Shape, or System?
- What object am I editing?
- What does the touched knob or held modifier affect?
- Is there a route/setup problem I need to fix?

## LED Language

Define LED meaning once and reuse it:

- track identity;
- active track;
- clip content, playing, queued, and empty;
- muted and soloed;
- recording and armed;
- motion present or recording;
- co-run active;
- setup warning.

Prefer fewer unmistakable states over many subtle colors. Respect the LED
per-tick budget; avoid writing the same LED from multiple paths in one tick.

## Emulator Boundary

The emulator validates layout, flow, interaction, text, and most UI state. It
does not prove real-engine sound, device timing/latency, the exact LED budget,
or real co-run behavior. Those remain device checks in `ROADMAP.md`.

## Open UX Questions

- How visible should the Ableton/open distinction be outside setup and sound
  editing?
- Should AUTO be renamed visibly to Motion, or introduced gradually in docs and
  overlays first?
- Which Global Menu actions deserve Shift+Step or context gestures?
- Should Performance Mode be reframed as Variations?
- How much dAVEBOx mode depth should remain visible to beginners by default?

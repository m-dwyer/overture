# Overture — UX Brief

The UX *is* the product (the augment base is proven; see `PHILOSOPHY.md`). This is the design home —
keep it current as the surface evolves. Prototype everything here in the **emulator** (`EMULATOR.md`)
before device.

## Design principles
1. **One instrument, not two.** The 4-Ableton / N-open seam is **invisible** for play/sequence/automate
   — uniform 8-track surface, consistent identity. Surface the distinction only where it *matters*.
2. **Unified automation, not "Move lacks p-locks."** Move already has native per-step parameter
   automation. Overture's job is to make automation legible across Move engines and Schwung/open
   tracks in the same deeper timeline.
3. **Delegate editing; don't rebuild it.** Sound/preset/param editing dips into the *native* editor via
   co-run (Schwung chain editor for open modules, Move device UI for Ableton) — Overture's own UI stays
   focused on the **sequencer + motion**. (See `ARCHITECTURE.md` "Editing model".)
4. **Immediacy + legibility over depth.** dAVEBOx errs toward modality; Overture should **edit down** —
   flatter, more discoverable, a coherent feedback language. More ≠ better.
5. **Design in the emulator.** Every flow is prototyped in the browser harness first.

## The two differentiators (where to spend design energy)
- **Cohesive hybrid surface** — the seam disappears.
- **Unified depth** — 8 tracks, trig conditions, polyrhythmic automation, bake/export, and one
  timeline for Move engines plus Schwung/open tracks.

## Current vs target behavior

| Area | Current behavior | Target behavior |
|---|---|---|
| Track navigation | Side buttons select tracks 1-4; Shift + side selects tracks 5-8. Shift+jog and Shift+bottom-pad remain fallbacks. | Keep this as the primary track model; polish labels and LEDs only where needed. |
| Clip selection | Hold a side button to reveal that track's 16 clips on the step buttons; tap a step to select/launch. Session View keeps clip performance and clip operations. | Polish reveal LED states and blink timing without making clips always consume the side buttons again. |
| Sound editing | Co-run is implemented for Move-native and Schwung-chain editing, with route-specific entry labels in current builds. | Present one `Edit Sound...` command with route-specific preflight/status overlays. |
| Route setup | Users configure Move MIDI channels and Schwung slots manually. | Add a Route Check screen for expected routes and obvious slot/channel problems. |
| Parameter state | dAVEBOx depth is available but labels and scopes require prior knowledge. | Add param peek and clearer automation-lane labels. |
| Step editing | Hold step + jog edits length; K controls keep the deep editor. | Add Move-like velocity, transpose, and nudge shortcuts while preserving trig-depth controls. |

## Automation layer
- **Motion-record:** while a clip plays, turn a knob → captures into that track's automation lane
  (Elektron/MPC feel). Ableton tracks → cable-0 encoder CC; open tracks → existing CC/AT lanes.
- **Automation view:** see which params have motion; edit per-step or as a curve; clear/clone; clear
  OLED + LED feedback for what's automating and what's recording.
- **One gesture in, one gesture out** — automation is a *layer* over the normal sequencer, not a
  separate app.

## The co-run "zoom into sound" gesture
- Co-run is implemented: Move-routed tracks can enter Move's device UI, and Schwung-routed tracks can
  enter Schwung's chain editor while Overture keeps sequencing.
- **One consistent command for both track kinds** (`Edit Sound...`) → dips into the right native
  editor (Move device UI / Schwung chain) → returns you exactly where you were.
- No mode whiplash; the transition is where it feels polished or clunky — design it deliberately.

## Color / feedback language (define once, legibly)
- Track identity colors; playhead; **automation-active**; mute/solo; recording/armed.
- Respect the **LED per-tick budget** (later writes drop — `HYBRID-GROOVEBOX.md` notes this); don't
  write the same LED from two paths in a tick.
- Pin the LED color map (currently "unconfirmed") as part of this.

## OLED (128×64, 1-bit)
- Clear state-at-a-glance: active track, clip, transport, automation-armed, current mode.
- Information hierarchy over density; legibility on a tiny mono screen is a real constraint.

## Lower-priority opportunities
- **Unified levels/mix overview** (the audio side is currently split across tool/Move/Schwung).
- **Performance focus:** scene morphs, the mod-snapshot idea (dAVEBOx has it), motion-as-performance.

## Honest boundary
The emulator validates *layout, flow, interaction, feedback* — **not** real-engine sound, device
timing/latency, the LED budget exactly, or co-run's real behavior. Those are device checks
(`ROADMAP.md` P0 / P4 / P5). Design here; confirm there.

## Open UX questions
- How visible is the Ableton/open distinction (invisible vs subtle badge)?
- Automation-record interaction (live-capture vs step-draw vs both); how it reads on the OLED/LEDs.
- The exact `Edit Sound...` preflight/return wording and how route failures should read.
- How much of dAVEBOx's mode depth to keep vs cut.

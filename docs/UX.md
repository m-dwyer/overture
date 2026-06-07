# Overture — UX Brief

The UX *is* the product (the augment base is proven; see `PHILOSOPHY.md`). This is the design home —
keep it current as the surface evolves. Prototype everything here in the **emulator** (`EMULATOR.md`)
before device.

## Design principles
1. **One instrument, not two.** The 4-Ableton / N-open seam is **invisible** for play/sequence/automate
   — uniform 8-track surface, consistent identity. Surface the distinction only where it *matters*.
2. **Motion is the flagship.** Sequenced parameter automation of *real Ableton engines* is what nothing
   else does — make it a first-class, delightful gesture, not a buried lane.
3. **Delegate editing; don't rebuild it.** Sound/preset/param editing dips into the *native* editor via
   co-run (Schwung chain editor for open modules, Move device UI for Ableton) — Overture's own UI stays
   focused on the **sequencer + motion**. (See `ARCHITECTURE.md` "Editing model".)
4. **Immediacy + legibility over depth.** dAVEBOx errs toward modality; Overture should **edit down** —
   flatter, more discoverable, a coherent feedback language. More ≠ better.
5. **Design in the emulator.** Every flow is prototyped in the browser harness first.

## The two differentiators (where to spend design energy)
- **Cohesive hybrid surface** — the seam disappears.
- **The motion lane** — automate the real engines from the sequencer.

## Mode / navigation model (to design in emulator — sketch)
- **Views:** Session (clip grid / launch) ↔ Track (edit one clip) — mirror Move's Note/Session; refine.
- **Track navigation (fix dAVEBOx's friction):** **4 track buttons = a bank; a modifier swaps banks
  1–4 / 5–8**, with clear LED state. Direct, Move-native muscle memory (vs dAVEBOx's shift+pad).
- **Mode discoverability:** contextual LED hints (light up what a held modifier does), consistent
  "hold X → see Y" patterns.

## Flagship: the Motion lane
- **Motion-record:** while a clip plays, turn a knob → captures into that track's automation lane
  (Elektron/MPC feel). Ableton tracks → cable-0 encoder CC; open tracks → existing CC/AT lanes.
- **Motion view:** see which params have motion; edit per-step or as a curve; clear/clone; clear OLED +
  LED feedback for what's automating and what's recording.
- **One gesture in, one gesture out** — motion is a *layer* over the normal sequencer, not a separate app.

## The co-run "zoom into sound" gesture
- **One consistent gesture for both track kinds** (e.g. hold track + Edit) → dips into the right native
  editor (Move device UI / Schwung chain) → **Back returns you exactly where you were.**
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
- Motion-record interaction (live-capture vs step-draw vs both); how it reads on the OLED/LEDs.
- The exact co-run entry/exit gesture and how seamless it can be made.
- How much of dAVEBOx's mode depth to keep vs cut.

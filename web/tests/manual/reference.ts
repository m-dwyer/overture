import { ARIA } from "./driver";
import type { Scene } from "./types";

// The full Overture reference as data: ordered scenes, each with curated prose,
// the figures to capture, and the real-gesture drive() fns that reach each
// figure's state. Adding/reordering a scene is an edit here — no spec surgery.
//
// Conventions:
//  - Figures are prefixed `ref-` so they never collide with the beginner guide's
//    figures in the shared docs/generated/assets/ directory.
//  - "Held" figures (clip reveal, Step Edit, step-length) leave a control held so
//    the capture catches the live overlay; those scenes carry a single shot so no
//    later shot inherits the held state (each scene boots a fresh page anyway).
//  - Every callout target is an aria-label that exists in the emulator DOM
//    (annotate() hard-fails otherwise — the contract test).
export const scenes: Scene[] = [
  {
    title: "The Control Surface",
    slug: "the-control-surface",
    body: [
      "Overture mirrors the Move control surface: the OLED on the left, eight encoders (K1-K8) across the top, a 4x8 pad grid, the Note/Session and Back buttons left of the pads, the step buttons along the bottom, four track side buttons, and the right-hand button cluster (Capture, Loop, Delete, Copy, Undo, Shift, transport).",
      "The OLED is always the source of truth. It names the current mode, the track or pad in focus, and the active parameter bank — refer back to it whenever a control's effect isn't obvious.",
    ],
    shots: [
      {
        file: "ref-01-surface.png",
        title: "The Overture surface",
        action: "Open Overture",
        showing:
          "Startup overview: scene per track, lit pads, side buttons, and step LEDs",
        caption:
          "The full panel. Encoders top, pad grid centre, step buttons bottom, track side buttons right of the grid, transport and modifiers in the right cluster. The OLED names the current mode and bank.",
      },
      {
        file: "ref-02-oled.png",
        title: "Reading the OLED",
        action: "Open Overture",
        showing:
          "The OLED names the mode, the track or pad in focus, and the active parameter bank",
        crop: "oled",
        caption:
          "The OLED up close. Full-panel figures show it small, so refer back here: it always names the mode, the focused track/pad, and the active bank.",
      },
    ],
  },
  {
    title: "The Two Views",
    slug: "the-two-views",
    body: [
      "Overture alternates between Track View — editing one clip in detail — and Session View — launching and arranging clips across tracks. Tap Note/Session to switch; it is a pure toggle.",
      "Arrangement lives in Session View; detailed note and parameter editing lives in Track View. Almost everything in this manual is one or the other.",
    ],
    shots: [
      {
        file: "ref-03-track-view.png",
        expect: { sessionView: false, activeTrack: 0 },
        title: "Track View",
        action: "Tap Note/Session until Track View is active",
        showing:
          "Track View: edit one clip with pads, steps, jog, and encoders",
        targets: [{ aria: ARIA.noteSession, name: "Note/Session" }],
        drive: (d) => d.enterTrackView(),
        caption:
          "Track View is the detailed editor: pads play notes or drum lanes, the step row edits the active clip, the jog moves through parameter banks, and K1-K8 edit the visible bank.",
      },
      {
        file: "ref-04-session-view.png",
        expect: { sessionView: true },
        title: "Session View",
        action: "Tap Note/Session to switch to Session View",
        showing:
          "Session View: numbers are tracks; letters are the active scene per track",
        targets: [{ aria: ARIA.noteSession, name: "Note/Session" }],
        drive: (d) => d.enterSessionView(),
        caption:
          "Session View is the clip launcher: the pad grid represents clips across tracks and scene rows.",
      },
    ],
  },
  {
    title: "Selecting Tracks",
    slug: "selecting-tracks",
    body: [
      "In Track View the four side buttons select tracks 1-4 (this is Overture's Move-native change — side buttons are track identity first, not clip buttons). The active button glows in the track colour; the others stay dim.",
      "Hold Shift while tapping a side button to reach the upper bank, tracks 5-8. Shift + jog and Shift + bottom-row pad also switch tracks, as fallbacks.",
    ],
    shots: [
      {
        file: "ref-05-track-select.png",
        expect: { sessionView: false, activeTrack: 1 },
        title: "Side buttons select tracks",
        action: "Track View: tap side button 2",
        showing:
          "Track selection: the active side-button LED marks the current track",
        targets: [{ aria: ARIA.track(2), name: "Side button 2" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(2);
        },
        caption:
          "Tapping the second side button selects track 2. The active button lights in the track colour; the rest stay dim.",
      },
      {
        file: "ref-06-shift-track-select.png",
        expect: { activeTrack: 4 },
        title: "Shift reaches tracks 5-8",
        action: "Hold Shift + tap side button 1",
        showing:
          "Upper bank: Shift + side button selects tracks 5-8 on the same four buttons",
        targets: [
          { aria: ARIA.shift, name: "Shift" },
          { aria: ARIA.track(1), name: "Side button 1" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(5);
        },
        caption:
          "Hold Shift and tap the first side button to select track 5. The four side buttons address 1-4 normally and 5-8 under Shift.",
      },
    ],
  },
  {
    title: "Switching Clips",
    slug: "switching-clips",
    body: [
      "Clips no longer live on the side buttons. To switch a track's active clip, hold that track's side button: its 16 clips appear on the step buttons — the active clip solid, playing clips flashing, clips with content dim, empty clips dark.",
      "Tap a step to select or launch that clip, then release the side button to return to the step pattern. A quick tap (released before the overlay appears) just selects the track.",
    ],
    shots: [
      {
        file: "ref-07-clip-reveal.png",
        expect: { sessionView: false, activeTrack: 0 },
        title: "Hold a side button to reveal clips",
        action: "Track View: hold side button 1, then tap a step",
        showing: "Clip overlay: the 16 step buttons are track 1's 16 clips",
        targets: [
          { aria: ARIA.track(1), name: "Held side button" },
          { aria: ARIA.step(3), name: "Clip 3" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.holdClipReveal(1);
          await d.selectClipStep(3);
          // left held so the figure captures the live clip overlay
        },
        caption:
          "Holding the side button turns the step row into track 1's 16 clips; tapping step 3 selects/launches clip 3. Release the button to return to the pattern.",
      },
    ],
  },
  {
    title: "A First Drum Pattern",
    slug: "a-first-drum-pattern",
    body: [
      "On a drum track the left side of the pad grid selects drum lanes. With a lane active, the sixteen step buttons place hits for that lane.",
      "This is the fastest way to make Overture feel concrete: pick a lane, place a few steps, then press Play.",
    ],
    shots: [
      {
        file: "ref-08-drum-pattern.png",
        expect: { sessionView: false, activeTrack: 0 },
        title: "A simple lane pattern",
        action: "Drum track: tap a lane pad, then Steps 1, 5, 9, 13",
        showing:
          "A drum lane pattern: lit step buttons are hits on the active lane",
        targets: [
          { aria: ARIA.pad(1), name: "Drum lane pad" },
          { aria: ARIA.step(1), name: "Hit" },
          { aria: ARIA.step(5), name: "Hit" },
          { aria: ARIA.step(9), name: "Hit" },
          { aria: ARIA.step(13), name: "Hit" },
        ],
        drive: async (d) => {
          await d.enterDrumTrackView();
          await d.tapStep(1);
          await d.tapStep(5);
          await d.tapStep(9);
          await d.tapStep(13);
        },
        caption:
          "Four lit steps are a four-on-the-floor hit pattern on the active drum lane. The OLED stays the source of truth for the current lane and edit context.",
      },
    ],
  },
  {
    title: "Step Entry and Chords",
    slug: "step-entry-and-chords",
    body: [
      "On a melodic track, tap the step buttons to place notes on the active clip; the pads play and audition pitches. New melodic steps default to a full step length (Move's keys presets are voiced for sustained notes); new drum steps stay at a tight half step.",
      "To enter a chord, hold several pads together and tap a step — every held pitch is written to that step.",
    ],
    shots: [
      {
        file: "ref-09-chord-entry.png",
        expect: { activeTrack: 1 },
        title: "Chord entry",
        action: "Hold three pads, then tap a step",
        showing:
          "Chord entry: the held pads are written to the tapped step together",
        targets: [
          { aria: ARIA.pad(1), name: "Chord note" },
          { aria: ARIA.pad(3), name: "Chord note" },
          { aria: ARIA.pad(5), name: "Chord note" },
          { aria: ARIA.step(1), name: "Target step" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(2); // melodic track — pads are pitches, not drum lanes
          await d.holdPads([1, 3, 5]);
          await d.tapStep(1);
          await d.releasePads([1, 3, 5]);
        },
        caption:
          "On a melodic track, holding pads 1, 3 and 5 and tapping step 1 writes all three pitches to that step as a chord.",
      },
    ],
  },
  {
    title: "Step Edit",
    slug: "step-edit",
    body: [
      "Hold a step to open Step Edit for that step. The OLED shows the step's per-note detail and the encoders edit it: length, velocity, micro-timing, and the trig conditions Iter (fire every Nth loop), Prob (fire by chance), and Ratch (retrigger within the step).",
      "Release the step to return to the pattern. Step Edit is how a flat pattern becomes a living one.",
    ],
    shots: [
      {
        file: "ref-10-step-edit.png",
        // The "STEP EDIT" header is bitmap-drawn (not print()), so assert the
        // printed trig-condition rows that are unique to the Step Edit screen.
        expect: { oledIncludes: ["Iter", "Prob", "Ratch"] },
        title: "Hold a step to edit it",
        action: "Place a step, then hold it",
        showing:
          "Step Edit: the held step's length, velocity, timing and trig conditions",
        targets: [{ aria: ARIA.step(1), name: "Held step" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.tapStep(1);
          await d.stepEditOpen(1); // left held → captures the Step Edit screen
        },
        caption:
          "Holding a placed step opens Step Edit: the encoders now edit that one step. The trig conditions (Iter / Prob / Ratch) live here.",
      },
    ],
  },
  {
    title: "Per-Step Length on the Jog",
    slug: "per-step-length-on-the-jog",
    body: [
      "Hold a step and turn the jog wheel to adjust that step's length — Move's \"hold step + wheel = length\" gesture. On an empty step the jog does nothing.",
      "Turning the jog while holding a step is reserved for step length and never changes banks underneath.",
    ],
    shots: [
      {
        file: "ref-11-step-length.png",
        expect: { oledIncludes: ["Leng", "Ratch"] }, // Step Edit screen, length row visible
        title: "Hold step + jog = length",
        action: "Hold a placed step and turn the jog",
        showing:
          "Step length: the jog stretches the held step, never changing banks",
        targets: [
          { aria: ARIA.step(1), name: "Held step" },
          { aria: ARIA.jog, name: "Jog" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.tapStep(1);
          await d.stepEditOpen(1);
          await d.turnJog(2); // step left held so the figure shows the live length edit
        },
        caption:
          "With the step held, the jog adjusts its length. Releasing the step returns to the pattern with the parameter bank unchanged.",
      },
    ],
  },
  {
    title: "Parameter Banks",
    slug: "parameter-banks",
    body: [
      "Turn the jog to move through the parameter banks for the active clip; the Track-View header shows a bank-position strip — a tick per bank with the active one as a tall block — so you can see how many banks exist and where you are. Turn K1-K8 to edit the eight values in the visible bank.",
      "On a melodic track the banks in order are CLIP, NOTE FX, HARMONY, DELAY, SEQ ARP, ARP IN, and AUTO; a drum track swaps in DRUM LANE, ALL LANES and REPEAT GROOVE. Most values are clip-specific, so switching clips can change what the same controls do.",
    ],
    shots: [
      {
        file: "ref-12-bank.png",
        expect: { activeTrack: 1, activeBank: 2 },
        title: "Bank editing",
        action: "On a melodic track, turn the jog to a bank, then turn K3",
        showing:
          "Parameter editing: the OLED rows map to K1-K8 above the pad grid",
        targets: [
          { aria: ARIA.jog, name: "Jog" },
          { aria: ARIA.encoder(3), name: "K3" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(2); // a melodic track, so the named melodic banks apply
          await d.selectBank(0); // home to CLIP so the jog count is deterministic
          await d.turnJog(2); // CLIP -> NOTE FX -> HARMONY
          await d.turnEncoder(3, 5);
        },
        caption:
          "The OLED shows the active bank (here HARMONY) and its eight encoder rows. Turning an encoder updates the matching value; the header strip marks the bank position.",
      },
      {
        file: "ref-13-bank-oled.png",
        expect: { activeTrack: 1, activeBank: 2 },
        title: "The bank readout up close",
        action: "Turn the jog to a bank, then turn K3",
        showing: "Each OLED row is one encoder, in K1-K8 order left to right",
        crop: "oled",
        caption:
          "The OLED row order matches K1-K8 left to right — the close-up makes the active bank and its values legible.",
      },
    ],
  },
  {
    title: "Effects Banks",
    slug: "effects-banks",
    body: [
      "Several parameter banks are effects that process the track's notes before they leave Overture: NOTE FX (per-note transforms and gating), HARMONY (added intervals, melodic only), DELAY (tempo-synced echoes), and the arpeggiators SEQ ARP and ARP IN.",
      "They are reached the same way as any bank — turn the jog — and edited on K1-K8. Overture generates no audio itself; these shape the MIDI sent to Move's instruments or an external synth.",
    ],
    shots: [
      {
        file: "ref-14-fx-bank.png",
        // Bank index 3 = DELAY; assert its feedback param labels (printed rows) —
        // ties the figure to the DELAY bank even if the header is bitmap-drawn.
        expect: { activeTrack: 1, activeBank: 3, oledIncludes: ["Vfb", "Pfb"] },
        title: "An effects bank",
        action: "Turn the jog to an effects bank",
        showing:
          "An effects bank (e.g. DELAY / NOTE FX): eight K1-K8 parameters",
        crop: "oled",
        targets: [{ aria: ARIA.jog, name: "Jog" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(2); // melodic track exposes the full effects chain
          await d.selectBank(0); // home to CLIP so the jog count is deterministic
          await d.turnJog(3); // CLIP -> NOTE FX -> HARMONY -> DELAY
        },
        caption:
          "Stepping the jog past CLIP reaches the effects banks (here DELAY). Each is eight encoder values; the OLED names the bank so you always know which effect you're editing.",
      },
    ],
  },
  {
    title: "Automation",
    slug: "automation",
    body: [
      "The AUTO bank records parameter automation as per-step CC lanes (p-locks): pick a target with the encoders and the value is stored per step, so a sweep or a moving filter rides with the clip.",
      "The edit surface is shown here. Automation *playback* — the recorded CCs being emitted as the clip plays — is verified on the device; the emulator models the edit, not the live emission.",
    ],
    shots: [
      {
        file: "ref-15-auto.png",
        expect: { activeTrack: 1, activeBank: 6, oledIncludes: "CC7" }, // AUTO bank: per-step CC lanes
        title: "The AUTO bank",
        action: "Turn the jog to the AUTO bank",
        showing: "Automation: per-step CC lanes (p-locks) for the active clip",
        crop: "oled",
        targets: [{ aria: ARIA.jog, name: "Jog" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(2); // melodic bank chain: AUTO is the last bank
          await d.selectBank(0); // home to CLIP so the jog count is deterministic
          await d.turnJog(6); // CLIP(0) -> ... -> AUTO(6)
        },
        caption:
          "AUTO records per-step parameter values that ride with the clip. (Device-only: the recorded CCs emit during playback on hardware — the emulator shows the edit surface, not the live emission.)",
      },
    ],
  },
  {
    title: "Editing Schwung Sounds",
    slug: "editing-schwung-sounds",
    body: [
      "Shift + Step 3 edits the active track's sound source. On a Schwung-routed track, Overture opens its own Sound page for the matching Schwung slot instead of immediately handing you to Schwung's chain editor.",
      "The Sound page has four components: MIDI FX, Synth, FX 1, and FX 2. While the page is open, Step 1-4 jumps directly to those components. Shift + the already-selected component step enters Schwung's deeper chain editor for the current slot. If the selected component exposes parameters through Schwung metadata, Overture opens directly in parameter detail.",
      "Parameter detail is an 8-encoder bank: K1-K8 edit the visible params, and turning the jog moves to the next or previous bank when a module exposes more than eight. Touching or turning an encoder briefly opens a focused param peek with a larger value and range bar. Numeric, enum, and bool params are editable; string, file, and canvas params are shown read-only.",
      "Copy + jog-click opens the preset browser. Overture user presets appear first; module factory presets appear as starting points when the loaded module exposes Schwung's `preset_count` / `preset` / `preset_name` convention. After applying a factory preset, tweak the params and use Capture + jog-click to save the result as an Overture user preset.",
      "Menu exits this Overture Sound page. Deep Edit is a best-effort fallback into Schwung's own chain editor for module-specific UIs; use Shift + jog-click, or Shift + the selected component step. Overture does not directly import or execute a module's `ui.js` or `ui_chain.js`.",
    ],
    shots: [
      {
        file: "ref-16-schwung-sound.png",
        expect: { activeTrack: 4, oledIncludes: ["SYNTH", "aurora"] },
        title: "Open the Schwung Sound page",
        action: "Select track 5, then hold Shift + tap Step 3",
        showing: "Sound page: Synth component params are mapped to K1-K8",
        targets: [
          { aria: ARIA.track(1), name: "Track 5 (Shift + side 1)" },
          { aria: ARIA.shift, name: "Shift" },
          { aria: ARIA.step(3), name: "Step 3" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.selectTrack(5);
          await d.shiftStep(3);
        },
        caption:
          "Track 5 is Schwung-routed in the default setup. Shift + Step 3 opens Overture's Sound page for Slot 1. Because the Synth module exposes params, the page opens directly with K1-K8 assigned to the first parameter bank.",
      },
      {
        file: "ref-17-schwung-param-peek.png",
        expect: { activeTrack: 4, oledIncludes: ["Gain"] },
        title: "Param peek while editing",
        action: "Turn K1 on the Sound page",
        showing: "Focused param peek: large value readout and range bar",
        targets: [{ aria: ARIA.encoder(1), name: "K1" }],
        drive: async (d) => {
          await d.turnEncoder(1, 4);
        },
        caption:
          "Turning K1 edits the first visible module parameter. The focused peek makes the touched value easier to read while playing, then times out back to the 8-param overview.",
      },
      {
        file: "ref-18-schwung-components.png",
        expect: { activeTrack: 4, oledIncludes: ["FX1", "freeverb", "Mix"] },
        title: "Jump between Schwung components",
        action: "While Sound is open, tap Step 3",
        showing: "Component jump: Step 1-4 select MIDI FX, Synth, FX 1, FX 2",
        targets: [{ aria: ARIA.step(3), name: "Step 3 = FX 1" }],
        drive: async (d) => {
          await d.tapStep(3);
        },
        caption:
          "Inside the Sound page, Step 1-4 are direct component jumps: MIDI FX, Synth, FX 1, and FX 2. Components with visible params open in detail; otherwise they show the module overview/browser path.",
      },
      {
        file: "ref-19-schwung-presets.png",
        expect: {
          activeTrack: 4,
          oledIncludes: [
            "Synth Presets",
            "Driven Bass",
            "Warm Keys",
            "Analog Bass",
          ],
        },
        title: "Load user or factory presets",
        action: "Return to Synth, hold Copy + press the jog, then turn the jog",
        showing:
          "Preset browser: Overture user presets first, module factory presets after",
        targets: [
          { aria: ARIA.step(2), name: "Step 2 = Synth" },
          { aria: ARIA.copy, name: "Copy" },
          { aria: ARIA.jogClick, name: "Jog click" },
          { aria: ARIA.jog, name: "Jog scroll" },
        ],
        drive: async (d) => {
          await d.tapStep(2);
          await d.copyJogClick();
          await d.turnJog(2);
        },
        caption:
          "The preset browser keeps Overture's own user presets at the top of the list. Factory rows are read from the loaded module's Schwung preset params and act as starting points; after loading one, Capture + jog-click saves the edited result as an Overture preset.",
      },
    ],
  },
  {
    title: "Launching and Arranging Clips",
    slug: "launching-and-arranging-clips",
    body: [
      "In Session View the pad grid is clips: columns are tracks, rows are scenes. Tap a clip pad to launch it; tap the side buttons to launch a whole scene row (Shift + side launches at the next bar boundary).",
      "This is where you arrange — building scenes and moving between them — while Track View stays focused on editing the selected clip.",
    ],
    shots: [
      {
        file: "ref-16-session-launch.png",
        expect: { sessionView: true },
        title: "Launch a clip",
        action: "Session View: tap a clip pad",
        showing:
          "Clip launch: the tapped pad selects/launches that clip and updates its track's scene letter",
        targets: [{ aria: ARIA.pad(1), name: "Clip pad" }],
        drive: async (d) => {
          await d.enterSessionView();
          await d.tapPad(1);
        },
        caption:
          "Tapping a clip pad launches that clip on its track; the OLED's track scene letter updates to match.",
      },
    ],
  },
  {
    title: "Copy, Cut, and Delete Clips",
    slug: "copy-cut-and-delete-clips",
    body: [
      "Per-clip operations live in Session View, on the clip pads (where Move keeps clip management). To copy a clip, hold Copy and tap the source clip — the OLED shows COPIED — then, still holding Copy, tap the destination clip to paste it. Releasing Copy forgets the source, so keep it held across both taps.",
      "Shift + Copy cuts instead of copies; Delete + a pad clears its notes; Shift + Delete hard-resets the clip (notes and all parameters). Drum clips copy and cut the same way, carrying all 32 lanes. In Overture these moved off the Track-View side buttons (which now select tracks) to here.",
    ],
    shots: [
      {
        file: "ref-17-clip-copy.png",
        expect: { sessionView: true },
        title: "Copy a clip",
        action:
          "Hold Copy, tap source clip (COPIED), then — still holding Copy — tap destination",
        showing:
          "Clip copy: keep Copy held while you tap source then destination",
        targets: [
          { aria: ARIA.copy, name: "Hold Copy (don't release)" },
          { aria: ARIA.pad(1), name: "Source clip" },
          { aria: ARIA.pad(2), name: "Destination clip" },
        ],
        drive: async (d) => {
          await d.enterSessionView();
          await d.copyClip(1, 2);
        },
        caption:
          "Hold Copy, tap a source clip (the OLED shows COPIED), then — without releasing Copy — tap the destination to paste. Release Copy and the source is forgotten. Delete + pad clears a clip; add Shift to cut or hard-reset.",
      },
    ],
  },
  {
    title: "Recording and Transport",
    slug: "recording-and-transport",
    body: [
      "With the transport stopped, tap Record: a one-bar count-in leads in over the metronome, then the transport starts and recording begins on its own — you do not press Play. Your pad and MIDI input is captured into the active clip in real time, quantised to the clip's grid. Tap Record again to stop.",
      "Live recording captures what step entry can't — feel and timing — and lands on the same steps you'd otherwise place by hand. (If the transport is already running, Record arms straight into capture with no count-in.)",
    ],
    shots: [
      {
        file: "ref-18-record.png",
        expect: { recording: true },
        title: "Arm recording",
        action: "Tap Record (no Play needed)",
        showing:
          "Transport: Record arms a one-bar count-in, then records automatically",
        targets: [{ aria: ARIA.record, name: "Record" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.toggleRecord();
        },
        caption:
          "Tapping Record arms a one-bar count-in (metronome on); the transport and recording then start by themselves — no Play press. Tap Record again to stop. (Count-in and capture timing are verified on the device.)",
      },
    ],
  },
  {
    title: "Pages, Octave, and Performance",
    slug: "pages-octave-and-performance",
    body: [
      "The ‹ › buttons page through a clip longer than 16 steps (and the loop view); Octave +/- shift the pad octave on melodic tracks (and transpose with Shift). The Loop button latches Performance mode — a live layer for momentary loops and repeats over the playing pattern.",
      "These are the live-playing controls: move around a long clip, reach the octave you want, and perform on top without disturbing the stored pattern.",
    ],
    shots: [
      {
        file: "ref-19-pages.png",
        expect: { sessionView: false },
        title: "Page through a clip",
        action: "Tap ‹ or › to change page",
        showing:
          "Paging: ‹ › move through a clip's step pages and the loop view",
        targets: [
          { aria: ARIA.navLeft, name: "Page ‹" },
          { aria: ARIA.navRight, name: "Page ›" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.pageNav(1);
        },
        caption:
          "‹ › page through a long clip's steps. Octave +/- shift the pad octave; the Loop button latches Performance mode for live loops over the pattern.",
      },
    ],
  },
  {
    title: "The Global Menu",
    slug: "the-global-menu",
    body: [
      "Hold Shift and tap Note/Session to open the Global Menu: track configuration plus project actions. Turn the jog to move the selection, press the jog to edit or confirm an item, and Back to leave.",
      "Track config (channel, route, pad mode, key/scale) and project actions (save, load, export, settings) all live here.",
    ],
    shots: [
      {
        file: "ref-20-menu.png",
        expect: { globalMenuOpen: true },
        title: "Open the Global Menu",
        action: "Hold Shift + tap Note/Session",
        showing: "Global Menu: jog scrolls; jog click edits or confirms",
        targets: [
          { aria: ARIA.shift, name: "Shift" },
          { aria: ARIA.noteSession, name: "Note/Session" },
        ],
        drive: (d) => d.openGlobalMenu(),
        caption:
          "Shift + Note/Session opens the menu. Turn the jog to move, press the jog to edit or confirm. The first pages focus on the active track.",
      },
      {
        file: "ref-21-menu-project.png",
        expect: { globalMenuOpen: true },
        title: "Project actions",
        action: "Turn the jog to Save / Load / Export",
        showing:
          "Project actions: save and load a session, or export to Ableton",
        targets: [{ aria: ARIA.jog, name: "Jog scroll" }],
        // The menu is already open from the previous shot (same scene, no reboot);
        // re-opening here would toggle it shut. Just scroll to the project actions.
        drive: (d) =>
          d.selectMenuLabel([
            "Save state",
            "Load state",
            "Export to Ableton",
            "Export",
          ]),
        caption:
          "Scrolling the jog reaches the project actions: save, load, export, and global settings. (Device-only: Export's final write to an Ableton Set happens through the host on hardware.)",
      },
    ],
  },
];

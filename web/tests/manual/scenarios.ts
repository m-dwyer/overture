import { ARIA, CC } from "./driver";
import type { Scene } from "./types";

// The beginner-guide content as data: ordered scenes, each with curated prose,
// the figures to capture, and the gestures (drive fns) that reach each figure's
// state. Adding or reordering a scene is an edit here — no test surgery.
export const scenes: Scene[] = [
  {
    title: "Orientation",
    slug: "orientation",
    body: [
      "The emulator mirrors the Move control surface: OLED on the left, encoders across the top, a 4x8 pad grid, four side buttons, and sixteen step buttons along the bottom.",
      "The OLED is always the source of truth: it names the current mode, track, and parameter bank.",
    ],
    shots: [
      {
        file: "01-orientation.png",
        title: "The Overture surface",
        action: "Open Overture",
        showing: "Startup overview: current scene per track, lit pads, side buttons, and step LEDs",
        caption:
          "Start here: the OLED tells you the current mode and parameter bank. The yellow Loop LED is Overture's live Session Performance latch indicator, not a pressed-control marker.",
      },
      {
        file: "01b-oled-readout.png",
        title: "Reading the OLED",
        action: "Open Overture",
        showing: "The OLED names the mode, the track or pad in focus, and the active parameter bank",
        crop: "oled",
        caption:
          "The OLED up close. It always names the current mode, the track or pad in focus, and the active parameter bank — the full-panel shots show it small, so refer back here.",
      },
    ],
  },
  {
    title: "The Two Main Views",
    slug: "the-two-main-views",
    body: [
      "Overture alternates between Track View for editing one clip in detail and Session View for launching or arranging clips across tracks.",
      "Tap Note/Session on the hardware to switch views. These screenshots drive that real view-toggle path, then wait for the emulator to settle before capture.",
    ],
    shots: [
      {
        file: "02-track-view.png",
        expect: { sessionView: false },
        title: "Track View",
        action: "Tap Note/Session until Track View is active",
        showing: "Track View: edit one clip with pads, steps, jog, and encoders",
        targets: [{ aria: ARIA.noteSession, name: "Note/Session" }],
        drive: (d) => d.enterTrackView(),
        caption:
          "Track View is the detailed editor: pads play notes or drum lanes, steps edit the active clip, and encoders edit the current parameter bank.",
      },
      {
        file: "03-session-view.png",
        expect: { sessionView: true },
        title: "Session View",
        action: "Tap Note/Session to switch to Session View",
        showing: "Session View: numbers are tracks; letters are active scenes, so A means scene A is selected",
        targets: [{ aria: ARIA.noteSession, name: "Note/Session" }],
        drive: (d) => d.enterSessionView(),
        caption: "Session View is the clip launcher: the pad grid represents clips across tracks and scene rows.",
      },
    ],
  },
  {
    title: "Make a First Drum Pattern",
    slug: "make-a-first-drum-pattern",
    body: [
      "On a drum track, the left side of the pad grid selects drum lanes. Once a lane is active, the sixteen step buttons place hits for that lane.",
      "This is the fastest path to making Overture feel concrete: choose a lane, add a few steps, then press Play on the device.",
    ],
    shots: [
      {
        file: "04-drum-pattern.png",
        expect: { sessionView: false, activeTrack: 0 },
        title: "A simple lane pattern",
        action: "Tap drum pad, then tap Steps 1, 5, 9, 13",
        showing: "A drum lane pattern: lit step buttons are hits on the active lane",
        targets: [
          { aria: ARIA.pad(1), name: "Drum lane pad" },
          { aria: ARIA.step(1), name: "Hit" },
          { aria: ARIA.step(5), name: "Hit" },
          { aria: ARIA.step(9), name: "Hit" },
          { aria: ARIA.step(13), name: "Hit" },
        ],
        drive: async (d) => {
          await d.enterDrumTrackView();
          await d.tapPad(1);
          await d.tapStep(1);
          await d.tapStep(5);
          await d.tapStep(9);
          await d.tapStep(13);
        },
        caption:
          "The lit step buttons show hits placed on the active drum lane. The OLED remains the source of truth for the current track, bank, and edit context.",
      },
    ],
  },
  {
    title: "Move Between Clips and Editing",
    slug: "move-between-clips-and-editing",
    body: [
      "Use Session View to focus or launch clips, then return to Track View when you want to edit the selected clip's notes and parameters.",
      "This split is central to Overture: arrangement lives in Session View; detailed editing lives in Track View.",
    ],
    shots: [
      {
        file: "05-session-launch.png",
        expect: { sessionView: true },
        title: "Focus a clip in Session View",
        action: "Tap a clip pad in Session View",
        showing: "Track 1 now shows D: the bottom-row clip pad selected scene D",
        targets: [{ aria: ARIA.pad(1), name: "Clip pad" }],
        drive: async (d) => {
          await d.enterSessionView();
          await d.tapPad(1);
        },
        caption:
          "The highlighted bottom-row clip pad selects scene D on track 1, which is why the OLED changes the track-1 scene letter to D.",
      },
      {
        file: "06-return-track-view.png",
        expect: { sessionView: false },
        title: "Return to detailed editing",
        action: "Tap Note/Session to return to Track View",
        showing: "The focused clip is now back on the detailed edit surface",
        targets: [
          { aria: ARIA.noteSession, name: "Back to Track View" },
          { aria: ARIA.step(1), name: "Clip steps" },
        ],
        drive: (d) => d.enterTrackView(),
        caption: "Back in Track View, the step row and parameter bank apply to the focused clip.",
      },
    ],
  },
  {
    title: "Select Tracks",
    slug: "select-tracks",
    body: [
      "In Overture's Track View, the four side buttons select tracks 1-4. Hold Shift with a side button to reach tracks 5-8.",
      "This is one of Overture's Move-native changes from dAVEBOx: side buttons are track identity first, not clip buttons.",
    ],
    shots: [
      {
        file: "07-track-select.png",
        expect: { sessionView: false, activeTrack: 1 },
        title: "Side buttons select tracks",
        action: "Track View: tap side button 2",
        showing: "Track selection: side-button LEDs indicate the active track bank",
        targets: [{ aria: ARIA.track(2), name: "Side button 2" }],
        drive: async (d) => {
          await d.enterTrackView();
          await d.pkt(CC, 42, 127);
          await d.settle();
          await d.pkt(CC, 42, 0);
          await d.settle();
        },
        caption: "The active side-button LED shows the selected track. Other side buttons stay dim in their track colors.",
      },
      {
        file: "08-shift-track-select.png",
        expect: { activeTrack: 4 },
        title: "Shift reaches the upper track bank",
        action: "Hold Shift + tap side button 1",
        showing: "Upper track bank: Shift + side buttons select tracks 5-8",
        targets: [
          { aria: ARIA.shift, name: "Shift" },
          { aria: ARIA.track(1), name: "Side button 1" },
        ],
        drive: async (d) => {
          await d.holdCc(49);
          await d.pkt(CC, 43, 127);
          await d.settle();
          await d.pkt(CC, 43, 0);
          await d.releaseCc(49);
        },
        caption: "Hold Shift while selecting a side button to address tracks 5-8.",
      },
    ],
  },
  {
    title: "Edit Parameters",
    slug: "edit-parameters",
    body: [
      "Turn the jog wheel to move through parameter banks. Turn K1-K8 to change values in the visible bank.",
      "Most values are clip-specific, so switching clips can change what the same controls do and what values they show.",
    ],
    shots: [
      {
        file: "09-parameter-bank.png",
        title: "Parameter bank editing",
        action: "Turn jog to a parameter bank, then turn K3",
        showing: "Parameter editing: the OLED rows map to K1-K8 above the pad grid",
        targets: [
          { aria: ARIA.jog, name: "Jog" },
          { aria: ARIA.encoder(3), name: "K3" },
        ],
        drive: async (d) => {
          await d.enterTrackView();
          await d.turnJog(2);
          await d.turnEncoder(3, 5);
        },
        caption:
          "The OLED shows the active bank and the eight encoder rows. Touching or turning an encoder updates the corresponding value.",
      },
      {
        file: "09b-parameter-oled.png",
        title: "The bank readout up close",
        action: "Turn jog to a parameter bank, then turn K3",
        showing: "Each OLED row is one encoder, in K1-K8 order left to right",
        crop: "oled",
        caption: "The OLED row order matches K1-K8 left to right. The close-up makes the active bank and its eight values legible.",
      },
    ],
  },
  {
    title: "Edit a Schwung Sound",
    slug: "edit-a-schwung-sound",
    body: [
      "Tracks 5-8 are Schwung/open-engine tracks in the default hybrid setup. Select one, then press Shift + Step 3 to open Overture's Sound page for that track.",
      "If the loaded Schwung module exposes parameters, the Sound page opens directly on its parameter detail. The eight encoders edit the visible params; touching or turning an encoder briefly shows a larger value readout. Turn the jog to move through additional 8-param banks. Menu exits the Sound page.",
    ],
    shots: [
      {
        file: "09c-schwung-sound.png",
        expect: { activeTrack: 4, oledIncludes: ["Synth", "linein"] },
        title: "Open Sound on a Schwung track",
        action: "Select track 5, then hold Shift + tap Step 3",
        showing: "Schwung Sound page: module params are mapped to K1-K8",
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
          "On a Schwung-routed track, Shift + Step 3 opens Overture's Sound page instead of dropping straight into Schwung's chain editor. Parameters exposed by the module are assigned to K1-K8.",
      },
      {
        file: "09d-schwung-param-peek.png",
        expect: { activeTrack: 4, oledIncludes: ["Gain"] },
        title: "Edit a module parameter",
        action: "Turn K1 on the Sound page",
        showing: "Param peek: the touched encoder gets a larger value readout",
        targets: [{ aria: ARIA.encoder(1), name: "K1" }],
        drive: async (d) => {
          await d.turnEncoder(1, 4);
        },
        caption:
          "Turning an encoder edits the visible Schwung parameter and temporarily replaces the grid with a focused value readout and range bar. The peek times out back to the overview.",
      },
    ],
  },
  {
    title: "Save and Export Entry Points",
    slug: "save-and-export-entry-points",
    body: [
      "The Global Menu contains track configuration plus project-level actions. Open it with Shift + Note/Session, rotate the jog to move, and press the jog to edit or confirm.",
      "This v1 guide only shows the entry points. It does not execute destructive or file-producing actions such as clearing a session or exporting.",
    ],
    shots: [
      {
        file: "10-global-menu.png",
        expect: { globalMenuOpen: true },
        title: "Open the Global Menu",
        action: "Hold Shift + tap Note/Session",
        showing: "Global Menu: jog selects rows; jog click edits or confirms",
        targets: [
          { aria: ARIA.shift, name: "Shift" },
          { aria: ARIA.noteSession, name: "Note/Session" },
        ],
        drive: (d) => d.openGlobalMenu(),
        caption: "Shift + Note/Session opens the menu. The first pages are usually focused on the active track.",
      },
      {
        file: "11-global-menu-scrolled.png",
        expect: { globalMenuOpen: true },
        title: "Scroll to project actions",
        action: "Rotate jog to Export / Save entries",
        showing: "Project actions live in the Global section; this guide only shows the entry points",
        targets: [{ aria: ARIA.jog, name: "Jog rotate" }],
        drive: (d) => d.selectMenuLabel(["Save state", "Load state", "Export to Ableton"]),
        caption:
          "Rotate the jog to reach additional actions such as save, load, export, and global settings.",
      },
    ],
  },
];

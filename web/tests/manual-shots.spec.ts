import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Generated beginner-manual figures. This drives the browser emulator's REAL
// ui.js + seq8-wasm engine through the same MIDI entry point as the hardware
// shell, then captures the Move-like panel from ?manual=1.

type Ovt = {
  midiIn(status: number, d1: number, d2: number): void;
};

interface Shot {
  title: string;
  file: string;
  caption: string;
}

interface Section {
  title: string;
  body: string[];
  shots: Shot[];
}

const REPO_ROOT = path.resolve(process.cwd(), "..");
const OUT_DIR = path.join(REPO_ROOT, "docs/generated");
const ASSET_DIR = path.join(OUT_DIR, "assets");
const GUIDE_PATH = path.join(OUT_DIR, "overture-beginner-guide.md");

test.skip(process.env.MANUAL_GENERATE !== "1", "Run with `pnpm -C web manual:generate`.");

const CC = 0xb0;
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const SHIFT = 49;
const MENU = 50;
const JOG = 14;

const pkt = async (page: Page, status: number, d1: number, d2: number) =>
  page.evaluate(
    ([s, a, b]) => (globalThis as typeof globalThis & { OVT: Ovt }).OVT.midiIn(s, a, b),
    [status, d1, d2]
  );

const settle = (page: Page, ms = 250) => page.waitForTimeout(ms);

async function boot(page: Page) {
  await page.goto("/?manual=1");
  await page.waitForFunction(() => Boolean((globalThis as typeof globalThis & { OVT?: unknown }).OVT));
  await settle(page, 2500);
}

async function pressCc(page: Page, cc: number) {
  await pkt(page, CC, cc, 127);
  await settle(page, 120);
  await pkt(page, CC, cc, 0);
  await settle(page);
}

async function holdCc(page: Page, cc: number) {
  await pkt(page, CC, cc, 127);
  await settle(page);
}

async function releaseCc(page: Page, cc: number) {
  await pkt(page, CC, cc, 0);
  await settle(page);
}

async function tapStep(page: Page, step: number) {
  const note = 15 + step;
  await pkt(page, NOTE_ON, note, 127);
  await settle(page, 120);
  await pkt(page, NOTE_OFF, note, 0);
  await settle(page);
}

async function tapPad(page: Page, pad: number) {
  const note = 67 + pad;
  await pkt(page, NOTE_ON, note, 110);
  await settle(page, 120);
  await pkt(page, NOTE_OFF, note, 0);
  await settle(page);
}

async function turnJog(page: Page, detents: number) {
  const val = detents > 0 ? 1 : 127;
  for (let i = 0; i < Math.abs(detents); i++) await pkt(page, CC, JOG, val);
  await settle(page);
}

async function turnEncoder(page: Page, encoder: number, detents: number) {
  const val = detents > 0 ? 1 : 127;
  const cc = 70 + encoder;
  for (let i = 0; i < Math.abs(detents); i++) await pkt(page, CC, cc, val);
  await settle(page);
}

async function openGlobalMenu(page: Page) {
  await holdCc(page, SHIFT);
  await pressCc(page, MENU);
  await releaseCc(page, SHIFT);
}

async function selectMenuLabel(page: Page, labels: string[]) {
  await page.evaluate((wanted) => {
    const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
    const items = state?.globalMenuItems as Array<{ label?: string }> | undefined;
    const menu = state?.globalMenuState as { selectedIndex: number } | undefined;
    if (!items || !menu) return;
    const idx = items.findIndex((item) => item.label && wanted.includes(item.label));
    if (idx >= 0) {
      menu.selectedIndex = idx;
      state.screenDirty = true;
    }
  }, labels);
  await settle(page);
}

async function enterTrackView(page: Page) {
  await page.evaluate(() => {
    const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
    if (!state) return;
    state.sessionView = false;
    state.activeTrack = 0;
    state.activeBank = 0;
    state.screenDirty = true;
  });
  await settle(page);
}

async function enterDrumTrackView(page: Page) {
  await page.evaluate(() => {
    const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
    if (!state) return;
    state.sessionView = false;
    state.activeTrack = 0;
    state.activeBank = 0;
    (state.activeDrumLane as number[] | undefined)?.splice(0, 1, 0);
    state.drumStepPage = state.drumStepPage || [];
    (state.drumStepPage as number[])[0] = 0;
    state.screenDirty = true;
  });
  await settle(page);
}

async function enterSessionView(page: Page) {
  await page.evaluate(() => {
    const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
    if (!state) return;
    state.sessionView = true;
    state.activeTrack = 0;
    state.screenDirty = true;
  });
  await settle(page);
}

async function capture(page: Page, file: string): Promise<void> {
  const out = path.join(ASSET_DIR, file);
  await page.locator("#manual-capture").screenshot({ path: out });
  expect(existsSync(out)).toBe(true);
}

async function gesture(page: Page, text: string) {
  await page.evaluate((label) => {
    globalThis.__OVT_MANUAL_GESTURE = label;
  }, text);
  await settle(page, 150);
}

function writeGuide(sections: Section[]) {
  const lines = [
    "# Overture Beginner Guide",
    "",
    "<!-- Generated by `pnpm -C web manual:generate`. Edit web/tests/manual-shots.spec.ts for scenarios and curated text. -->",
    "",
    "This guide is a screenshot-driven introduction to Overture's current UI. It is intentionally shorter than the inherited dAVEBOx manual: use it to learn the main surfaces first, then consult `overture-ui/MANUAL.md` for the full reference.",
    "",
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const para of section.body) lines.push(para, "");
    for (const shot of section.shots) {
      lines.push(`### ${shot.title}`, "", `![${shot.title}](assets/${shot.file})`, "", shot.caption, "");
    }
  }

  writeFileSync(GUIDE_PATH, lines.join("\n"), "utf8");
}

test("generate beginner manual figures and markdown", async ({ page }) => {
  test.setTimeout(90_000);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(ASSET_DIR, { recursive: true });

  const sections: Section[] = [];

  await boot(page);
  await gesture(page, "Open Overture");
  await capture(page, "01-orientation.png");
  sections.push({
    title: "Orientation",
    body: [
      "The emulator mirrors the Move control surface: OLED on the left, encoders across the top, a 4x8 pad grid, four side buttons, and sixteen step buttons along the bottom.",
      "Treat the screenshots as executable documentation: each one is produced by the real Overture UI running in the browser emulator.",
    ],
    shots: [
      {
        title: "The Overture surface",
        file: "01-orientation.png",
        caption: "Start here: the OLED tells you the current mode and parameter bank; pads, steps, side buttons, jog, and encoders drive the same MIDI entry points as the hardware.",
      },
    ],
  });

  await boot(page);
  await enterTrackView(page);
  await gesture(page, "Note/Session -> Track View");
  await capture(page, "02-track-view.png");
  await enterSessionView(page);
  await gesture(page, "Note/Session -> Session View");
  await capture(page, "03-session-view.png");
  sections.push({
    title: "The Two Main Views",
    body: [
      "Overture alternates between Track View for editing one clip in detail and Session View for launching or arranging clips across tracks.",
      "Tap Note/Session on the hardware to switch views. In this generated guide the scenario sets the view directly so the screenshots stay deterministic.",
    ],
    shots: [
      {
        title: "Track View",
        file: "02-track-view.png",
        caption: "Track View is the detailed editor: pads play notes or drum lanes, steps edit the active clip, and encoders edit the current parameter bank.",
      },
      {
        title: "Session View",
        file: "03-session-view.png",
        caption: "Session View is the clip launcher: the pad grid represents clips across tracks and scene rows.",
      },
    ],
  });

  await boot(page);
  await enterDrumTrackView(page);
  await tapPad(page, 1);
  await tapStep(page, 1);
  await tapStep(page, 5);
  await tapStep(page, 9);
  await tapStep(page, 13);
  await gesture(page, "Tap drum pad, then tap Steps 1, 5, 9, 13");
  await capture(page, "04-drum-pattern.png");
  sections.push({
    title: "Make a First Drum Pattern",
    body: [
      "On a drum track, the left side of the pad grid selects drum lanes. Once a lane is active, the sixteen step buttons place hits for that lane.",
      "This is the fastest path to making Overture feel concrete: choose a lane, add a few steps, then press Play on the device.",
    ],
    shots: [
      {
        title: "A simple lane pattern",
        file: "04-drum-pattern.png",
        caption: "The lit step buttons show hits placed on the active drum lane. The OLED remains the source of truth for the current track, bank, and edit context.",
      },
    ],
  });

  await boot(page);
  await enterSessionView(page);
  await tapPad(page, 1);
  await gesture(page, "Session View: tap clip pad");
  await capture(page, "05-session-launch.png");
  await enterTrackView(page);
  await gesture(page, "Return to Track View");
  await capture(page, "06-return-track-view.png");
  sections.push({
    title: "Move Between Clips and Editing",
    body: [
      "Use Session View to focus or launch clips, then return to Track View when you want to edit the selected clip's notes and parameters.",
      "This split is central to Overture: arrangement lives in Session View; detailed editing lives in Track View.",
    ],
    shots: [
      {
        title: "Focus a clip in Session View",
        file: "05-session-launch.png",
        caption: "A clip pad changes the active clip or queues a launch depending on transport state and clip content.",
      },
      {
        title: "Return to detailed editing",
        file: "06-return-track-view.png",
        caption: "Back in Track View, the step row and parameter bank apply to the focused clip.",
      },
    ],
  });

  await boot(page);
  await enterTrackView(page);
  await pkt(page, CC, 42, 127);
  await settle(page);
  await pkt(page, CC, 42, 0);
  await settle(page);
  await gesture(page, "Track View: tap side button 2");
  await capture(page, "07-track-select.png");
  await holdCc(page, SHIFT);
  await pkt(page, CC, 43, 127);
  await settle(page);
  await pkt(page, CC, 43, 0);
  await releaseCc(page, SHIFT);
  await gesture(page, "Hold Shift + tap side button 1");
  await capture(page, "08-shift-track-select.png");
  sections.push({
    title: "Select Tracks",
    body: [
      "In Overture's Track View, the four side buttons select tracks 1-4. Hold Shift with a side button to reach tracks 5-8.",
      "This is one of Overture's Move-native changes from dAVEBOx: side buttons are track identity first, not clip buttons.",
    ],
    shots: [
      {
        title: "Side buttons select tracks",
        file: "07-track-select.png",
        caption: "The active side-button LED shows the selected track. Other side buttons stay dim in their track colors.",
      },
      {
        title: "Shift reaches the upper track bank",
        file: "08-shift-track-select.png",
        caption: "Hold Shift while selecting a side button to address tracks 5-8.",
      },
    ],
  });

  await boot(page);
  await enterTrackView(page);
  await turnJog(page, 2);
  await turnEncoder(page, 3, 5);
  await gesture(page, "Turn jog to bank, then turn K3");
  await capture(page, "09-parameter-bank.png");
  sections.push({
    title: "Edit Parameters",
    body: [
      "Turn the jog wheel to move through parameter banks. Turn K1-K8 to change values in the visible bank.",
      "Most values are clip-specific, so switching clips can change what the same controls do and what values they show.",
    ],
    shots: [
      {
        title: "Parameter bank editing",
        file: "09-parameter-bank.png",
        caption: "The OLED shows the active bank and the eight encoder rows. Touching or turning an encoder updates the corresponding value.",
      },
    ],
  });

  await boot(page);
  await openGlobalMenu(page);
  await gesture(page, "Hold Shift + tap Note/Session");
  await capture(page, "10-global-menu.png");
  await selectMenuLabel(page, ["Save state", "Load state", "Export to Ableton"]);
  await gesture(page, "Rotate jog to Export / Save entries");
  await capture(page, "11-global-menu-scrolled.png");
  sections.push({
    title: "Save and Export Entry Points",
    body: [
      "The Global Menu contains track configuration plus project-level actions. Open it with Shift + Note/Session, rotate the jog to move, and press the jog to edit or confirm.",
      "This v1 guide only shows the entry points. It does not execute destructive or file-producing actions such as clearing a session or exporting.",
    ],
    shots: [
      {
        title: "Open the Global Menu",
        file: "10-global-menu.png",
        caption: "Shift + Note/Session opens the menu. The first pages are usually focused on the active track.",
      },
      {
        title: "Scroll to project actions",
        file: "11-global-menu-scrolled.png",
        caption: "Rotate the jog to reach additional actions such as save, load, export, and global settings.",
      },
    ],
  });

  writeGuide(sections);
  expect(existsSync(GUIDE_PATH)).toBe(true);
});

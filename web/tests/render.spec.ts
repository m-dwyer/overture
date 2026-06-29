import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { advanceTicks, waitReady } from "./wait";
import { createDefaultSequence } from "../../overture-next/src/domain/sequence";
import { TRACK_BANK_SIZE } from "../../overture-next/src/state/surface-addressing";
import { DEFAULT_TICKS_PER_STEP } from "../../overture-next/src/application/transport";
import {
  CC,
  NAV,
  NOTE_OFF,
  NOTE_ON,
  PAD_NOTE0,
  ROW_CC,
  SCHWUNG_SLOT_CHANNEL_FIRST,
  STEP_CC0,
} from "../../overture-next/src/host/move-controls";
import { SESSION_SCENE_COLUMNS, SESSION_TRACK_ROWS } from "../../overture-next/src/shared/session-grid";

const MIDI_PRESS = 127;
const MIDI_RELEASE = 0;
const TRACK_5_INDEX = TRACK_BANK_SIZE;
const TRACK_5_ROW = TRACK_5_INDEX % TRACK_BANK_SIZE;
const TRACK_5_SCENE_INDEX = 0;
const TRACK_5_DEFAULT_CLIP_PAD = (SESSION_TRACK_ROWS - 1 - TRACK_5_ROW) * SESSION_SCENE_COLUMNS + TRACK_5_SCENE_INDEX;
const TOGGLED_STEP_INDEX = 5;
const defaultSequence = createDefaultSequence();
const DEFAULT_STEP_4_NOTE = defaultSequence.steps[4].note;
const TOGGLED_STEP_NOTE = defaultSequence.steps[TOGGLED_STEP_INDEX].note;
const DEFAULT_STEP_VELOCITY = defaultSequence.steps[4].velocity;
const SCHWUNG_SLOT_0 = TRACK_5_INDEX - TRACK_BANK_SIZE;
const SCHWUNG_TRACK_5_CHANNEL = SCHWUNG_SLOT_CHANNEL_FIRST + SCHWUNG_SLOT_0;
const SCHWUNG_TRACK_5_NOTE_ON = NOTE_ON | SCHWUNG_TRACK_5_CHANNEL;
const SCHWUNG_TRACK_5_NOTE_OFF = NOTE_OFF | SCHWUNG_TRACK_5_CHANNEL;
const SCHWUNG_MIDI_DIRECTION = "live";
const TICKS_TO_STEP_4 = DEFAULT_TICKS_PER_STEP * 4;
const TICKS_TO_NEXT_STEP = DEFAULT_TICKS_PER_STEP;

type PageGlobal = typeof globalThis & {
  OVT: {
    leds: Map<number, number>;
    buttonLeds: Map<number, number>;
    midiIn(status: number, d1: number, d2: number): void;
    schwung?: {
      diagnostics(): {
        midi: Array<{ d1: number; d2: number; direction: string; slot: number; status: number }>;
      };
    };
  };
  __midi: number[][];
  onMidiMessageInternal?: (data: number[]) => unknown;
};

// Smoke + screenshot: the real tool UI should boot and render to the OLED canvas
// without throwing. Captures shot.png (full page) + shot-oled.png (crop) for review.
test("emulator boots the real tool UI and renders", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/");
  await waitReady(page); // boot complete: tool handle up, state loaded, splash done

  await page.screenshot({ path: "shot.png" });
  await page.locator("#oled").screenshot({ path: "shot-oled.png" });

  await expect(page.locator("#status")).toHaveText("running");
  expect(await page.locator("#log").textContent()).toContain("dsp: mock");
  // The tool must drive LEDs (via move_midi_internal_send) — at least some lit.
  const litLeds = await page.evaluate(() => {
    const o = (globalThis as PageGlobal).OVT;
    let n = 0;
    for (const c of o.leds.values()) if (c > 0) n++;
    for (const c of o.buttonLeds.values()) if (c > 0) n++;
    return n;
  });
  expect(litLeds, "tool should light some LEDs").toBeGreaterThan(0);
  if (consoleErrors.length) console.log("console errors:\n" + consoleErrors.slice(0, 25).join("\n"));
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("startup query selects track and note view after init settles", async ({ page }) => {
  await page.goto("/?track=5&view=note");
  await waitReady(page);
  await page.waitForFunction((trackIndex) => {
    const state = (globalThis as {
      overtureUiState?: { selectedTrackIndex?: number; activeTrack?: number; sessionView?: boolean };
    }).overtureUiState;
    return (state?.selectedTrackIndex ?? state?.activeTrack) === trackIndex && state?.sessionView === false;
  }, TRACK_5_INDEX);
});

// The shell must (a) emit the exact device MIDI on a click and (b) drive a visible
// re-render of the real UI.
test("hardware shell emits device MIDI and drives the UI", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/");
  await waitReady(page); // boot complete, on the resting main view
  await page.locator("#oled").screenshot({ path: "shot-session.png" });

  // (a) A DOM shell button delivers the exact device MIDI. Use Step 1 (CC16) —
  // a non-view-changing control so it doesn't disturb (b).
  await page.evaluate(() => {
    const g = globalThis as PageGlobal;
    const orig = g.onMidiMessageInternal;
    g.__midi = [];
    g.onMidiMessageInternal = (d: number[]) => { g.__midi.push([...d]); return orig?.(d); };
  });
  await page.locator("#shell .step").first().click();
  const midi = await page.evaluate(() => (globalThis as PageGlobal).__midi);
  expect(midi).toEqual([[NOTE_ON, STEP_CC0, MIDI_PRESS], [NOTE_OFF, STEP_CC0, MIDI_RELEASE]]);

  // (b) Shift+Menu opens the global menu → the OLED must change.
  const mi = (s: number, d1: number, d2: number) =>
    page.evaluate(([a, b, c]) => (globalThis as PageGlobal).OVT.midiIn(a, b, c), [s, d1, d2]);
  await mi(CC, NAV.Shift, MIDI_PRESS);
  await mi(CC, NAV.Menu, MIDI_PRESS);
  await mi(CC, NAV.Menu, MIDI_RELEASE);
  await mi(CC, NAV.Shift, MIDI_RELEASE);
  await advanceTicks(page, 4); // flush the menu-open redraw deterministically
  await page.locator("#oled").screenshot({ path: "shot-menu.png" });

  const before = await readFile("shot-session.png");
  const after = await readFile("shot-menu.png");
  expect(Buffer.compare(before, after), "OLED should change when input is received").not.toBe(0);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("keyboard Shift plus number key sends Shift + Step", async ({ page }) => {
  await page.goto("/");
  await waitReady(page); // handlers are wired only after boot — was the Array [] flake

  await page.evaluate(() => {
    const g = globalThis as PageGlobal;
    const orig = g.onMidiMessageInternal;
    g.__midi = [];
    g.onMidiMessageInternal = (d: number[]) => { g.__midi.push([...d]); return orig?.(d); };
  });

  const shiftButton = page.getByLabel("Shift", { exact: true });
  await page.keyboard.down("Shift");
  await expect(shiftButton).toHaveAttribute("aria-pressed", "true");
  await expect(shiftButton).toHaveClass(/pressed/);
  await page.keyboard.press("3");
  await page.keyboard.up("Shift");
  await expect(shiftButton).toHaveAttribute("aria-pressed", "false");
  await expect(shiftButton).not.toHaveClass(/pressed/);

  const midi = await page.evaluate(() => (globalThis as PageGlobal).__midi);
  expect(midi).toEqual([
    [CC, NAV.Shift, MIDI_PRESS],
    [NOTE_ON, STEP_CC0 + 2, MIDI_PRESS],
    [NOTE_OFF, STEP_CC0 + 2, MIDI_RELEASE],
    [CC, NAV.Shift, MIDI_RELEASE],
  ]);
});

test("Track 5 playback reaches the browser Schwung chain", async ({ page }) => {
  await page.goto("/");
  await waitReady(page);

  const mi = (s: number, d1: number, d2: number) =>
    page.evaluate(([a, b, c]) => (globalThis as PageGlobal).OVT.midiIn(a, b, c), [s, d1, d2]);

  await mi(CC, NAV.Shift, MIDI_PRESS);
  await mi(CC, ROW_CC[TRACK_5_ROW], MIDI_PRESS);
  await mi(CC, NAV.Shift, MIDI_RELEASE);
  await mi(CC, NAV.Menu, MIDI_PRESS);
  await mi(NOTE_ON, PAD_NOTE0 + TRACK_5_DEFAULT_CLIP_PAD, MIDI_PRESS);
  await mi(CC, NAV.Menu, MIDI_PRESS);
  await mi(CC, NAV.Play, MIDI_PRESS);
  await advanceTicks(page, TICKS_TO_STEP_4);

  const initialMidi = await page.evaluate(() => (globalThis as PageGlobal).OVT.schwung?.diagnostics().midi ?? []);
  expect(initialMidi).toContainEqual({
    d1: DEFAULT_STEP_4_NOTE,
    d2: DEFAULT_STEP_VELOCITY,
    direction: SCHWUNG_MIDI_DIRECTION,
    slot: SCHWUNG_SLOT_0,
    status: SCHWUNG_TRACK_5_NOTE_ON,
  });

  await mi(NOTE_ON, STEP_CC0 + TOGGLED_STEP_INDEX, MIDI_PRESS);
  await advanceTicks(page, TICKS_TO_NEXT_STEP);

  const editedMidi = await page.evaluate(() => (globalThis as PageGlobal).OVT.schwung?.diagnostics().midi ?? []);
  expect(editedMidi).toContainEqual({
    d1: DEFAULT_STEP_4_NOTE,
    d2: MIDI_RELEASE,
    direction: SCHWUNG_MIDI_DIRECTION,
    slot: SCHWUNG_SLOT_0,
    status: SCHWUNG_TRACK_5_NOTE_OFF,
  });
  expect(editedMidi).toContainEqual({
    d1: TOGGLED_STEP_NOTE,
    d2: DEFAULT_STEP_VELOCITY,
    direction: SCHWUNG_MIDI_DIRECTION,
    slot: SCHWUNG_SLOT_0,
    status: SCHWUNG_TRACK_5_NOTE_ON,
  });
  await advanceTicks(page, TICKS_TO_NEXT_STEP);
  const editedMidiAfterGate = await page.evaluate(() => (globalThis as PageGlobal).OVT.schwung?.diagnostics().midi ?? []);
  expect(editedMidiAfterGate).toContainEqual({
    d1: TOGGLED_STEP_NOTE,
    d2: MIDI_RELEASE,
    direction: SCHWUNG_MIDI_DIRECTION,
    slot: SCHWUNG_SLOT_0,
    status: SCHWUNG_TRACK_5_NOTE_OFF,
  });
});

import { expect, test, type Page } from "@playwright/test";
import { advanceTicks, waitReady } from "./wait";
import { CC, NAV, STEP_CC0 } from "../../overture-next/src/host/move-controls";

type DisplayPageGlobal = typeof globalThis & {
  OVT: {
    midiIn(status: number, d1: number, d2: number): void;
  };
  overtureUiState?: {
    selectedTrackIndex?: number;
    activeTrack?: number;
    sessionView?: boolean;
  };
  __OVT_OLED_TEXT?: string;
};

const MIDI_PRESS = 127;
const MIDI_RELEASE = 0;

const mi = (page: Page, status: number, d1: number, d2: number) =>
  page.evaluate(
    ([a, b, c]) => (globalThis as DisplayPageGlobal).OVT.midiIn(a, b, c),
    [status, d1, d2],
  );

const shiftDown = (page: Page) => mi(page, CC, NAV.Shift, MIDI_PRESS);
const shiftUp = (page: Page) => mi(page, CC, NAV.Shift, MIDI_RELEASE);

async function step(page: Page, stepNumber: number): Promise<void> {
  const note = STEP_CC0 + stepNumber - 1;
  await mi(page, 0x90, note, MIDI_PRESS);
  await mi(page, 0x80, note, MIDI_RELEASE);
}

async function bootTrackView(page: Page, trackNumber: number): Promise<void> {
  await page.goto("/?exact&track=" + trackNumber + "&view=note");
  await waitReady(page);
  await page.waitForFunction((trackIndex) => {
    const state = (globalThis as DisplayPageGlobal).overtureUiState;
    return (
      (state?.selectedTrackIndex ?? state?.activeTrack) === trackIndex &&
      state?.sessionView === false
    );
  }, trackNumber - 1);
  await advanceTicks(page, 4);
}

async function openSoundPage(page: Page): Promise<void> {
  await shiftDown(page);
  await step(page, 3);
  await shiftUp(page);
  await advanceTicks(page, 4);
}

async function oledText(page: Page): Promise<string> {
  return page.evaluate(
    () => (globalThis as DisplayPageGlobal).__OVT_OLED_TEXT ?? "",
  );
}

async function expectOledScreenshot(page: Page, name: string): Promise<void> {
  await advanceTicks(page, 4);
  await expect(page.locator("#oled")).toHaveScreenshot(name + ".png", {
    maxDiffPixelRatio: 0.02,
  });
}

test("Schwung Sound page uses the full OLED for synth parameter metadata", async ({
  page,
}) => {
  await bootTrackView(page, 5);
  await openSoundPage(page);

  await expect.poll(() => oledText(page)).toContain("Sound T5");
  const text = await oledText(page);

  expect(text).toContain("Slot1");
  expect(text).toContain("Synth Westfold");
  expect(text).toContain("Params");
  expect(text).toContain("Volume Ratio");
  expect(text).not.toContain("OVERTURE NEXT");
  expect(text).not.toContain("STOP");
  expect(text).not.toContain("TRACK");
  await expectOledScreenshot(page, "sound-page-schwung-params");
});

test("Move Sound page keeps the conservative native-track placeholder", async ({
  page,
}) => {
  await bootTrackView(page, 1);
  await openSoundPage(page);

  await expect.poll(() => oledText(page)).toContain("Sound T1");
  const text = await oledText(page);

  expect(text).toContain("Move Track 1");
  expect(text).toContain("Use Move Sound");
  expect(text).not.toContain("Params");
  expect(text).not.toContain("OVERTURE NEXT");
  await expectOledScreenshot(page, "sound-page-move-placeholder");
});

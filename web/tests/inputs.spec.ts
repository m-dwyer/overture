import { test, expect } from "@playwright/test";

// Input-completeness contract: the shell must be able to produce every input the
// real device emits. Here we assert the capacitive knob-touch notes (0..9) and the
// relative turn CCs the encoders/jog/volume send — the inputs davebox gates
// gestures + Shift LED hints on. This is the regression net for the I/O boundary.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGlobal = any;

async function startCapture(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const g = globalThis as AnyGlobal;
    const orig = g.onMidiMessageInternal;
    g.__midi = [];
    g.onMidiMessageInternal = (d: number[]) => {
      g.__midi.push([...d]);
      return orig?.(d);
    };
  });
}
const drain = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (globalThis as AnyGlobal).__midi.splice(0) as number[][]);

async function center(page: import("@playwright/test").Page, label: string) {
  const box = (await page.getByLabel(label).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2500);
  await startCapture(page);
});

test("encoder: capacitive touch note on press/release + relative CC on drag", async ({ page }) => {
  const { x, y } = await center(page, "Encoder 1");
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await drain(page)).toContainEqual([0x90, 0, 127]); // knob 1 touch ON (note 0)

  for (let i = 1; i <= 20; i++) await page.mouse.move(x, y - i); // drag up = clockwise
  const turn = await drain(page);
  expect(turn.filter((m) => m[0] === 0xb0 && m[1] === 71 && m[2] === 1).length).toBeGreaterThan(0); // CC 71 +1

  await page.mouse.up();
  expect(await drain(page)).toContainEqual([0x90, 0, 0]); // touch OFF
});

test("volume knob: CC 79 + master touch (note 8)", async ({ page }) => {
  const { x, y } = await center(page, "Volume");
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await drain(page)).toContainEqual([0x90, 8, 127]); // master touch ON
  for (let i = 1; i <= 20; i++) await page.mouse.move(x, y - i);
  const turn = await drain(page);
  expect(turn.filter((m) => m[0] === 0xb0 && m[1] === 79 && m[2] === 1).length).toBeGreaterThan(0); // CC 79
  await page.mouse.up();
  expect(await drain(page)).toContainEqual([0x90, 8, 0]);
});

test("jog wheel: main touch (note 9) on press/release", async ({ page }) => {
  const { box } = await center(page, "Jog wheel");
  // Press the ring near the top, away from the centre click button.
  const x = box.x + box.width / 2;
  const y = box.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await drain(page)).toContainEqual([0x90, 9, 127]); // jog touch ON
  await page.mouse.up();
  expect(await drain(page)).toContainEqual([0x90, 9, 0]); // touch OFF
});

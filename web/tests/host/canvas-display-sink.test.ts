import { describe, expect, it } from "vitest";
import { createCanvasDisplaySink } from "../../src/host/canvas-display-sink";
import { DEVICE_FONT } from "../../src/host/device-font";

// A recording 2D context: captures fillRect / fillText calls so we can assert the
// display sink's text rendering without a real canvas (vitest runs in node).
function recorderCanvas() {
  const fillRects: number[][] = [];
  const fillTexts: { text: string; x: number; y: number }[] = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textBaseline: "",
    fillRect: (x: number, y: number, w: number, h: number) =>
      fillRects.push([x, y, w, h]),
    fillText: (text: string, x: number, y: number) =>
      fillTexts.push({ text, x, y }),
  };
  const stub: unknown = { width: 128, height: 64, getContext: () => ctx };
  return { canvas: stub as HTMLCanvasElement, fillRects, fillTexts };
}

// Lit pixels of a glyph as [col, row] pairs, straight from the font data.
function litCells(ch: string): [number, number][] {
  const cells: [number, number][] = [];
  DEVICE_FONT[ch].forEach((bits, row) => {
    for (let col = 0; col < bits.length; col++)
      if (bits[col] === "1") cells.push([col, row]);
  });
  return cells;
}

describe("canvas display sink — text rendering", () => {
  it("Exact mode plots the literal device glyph as 1-bit blocks (no fillText)", () => {
    const { canvas, fillRects, fillTexts } = recorderCanvas();
    const display = createCanvasDisplaySink(
      canvas,
      () => 1,
      () => false,
    );

    display.print(0, 0, "A", 1);

    const expected = litCells("A").map(([col, row]) => [col, row, 1, 1]);
    expect(fillRects).toEqual(expected); // exactly the lit pixels, in row-major order
    expect(fillTexts).toHaveLength(0); // never touches the AA system font
  });

  it("scales each device pixel into an s×s block at the scaled origin", () => {
    const { canvas, fillRects } = recorderCanvas();
    const display = createCanvasDisplaySink(
      canvas,
      () => 8,
      () => false,
    );

    display.print(1, 2, "A", 1); // origin (1,2) → (8,16); blocks are 8×8

    expect(fillRects).toHaveLength(litCells("A").length);
    expect(fillRects.every(([, , w, h]) => w === 8 && h === 8)).toBe(true);
    const [c0, r0] = litCells("A")[0];
    expect(fillRects[0]).toEqual([8 + c0 * 8, 16 + r0 * 8, 8, 8]);
  });

  it("advances on the device's fixed 6px grid", () => {
    const { canvas, fillRects } = recorderCanvas();
    const display = createCanvasDisplaySink(
      canvas,
      () => 1,
      () => false,
    );

    display.print(0, 0, "AA", 1);

    const half = fillRects.length / 2;
    // Second glyph is the first shifted right by exactly one 6px cell.
    for (let i = 0; i < half; i++) {
      expect(fillRects[half + i][0]).toBe(fillRects[i][0] + 6);
      expect(fillRects[half + i][1]).toBe(fillRects[i][1]);
    }
  });

  it("Sharp/readable mode uses the AA system font, one fillText per char", () => {
    const { canvas, fillRects, fillTexts } = recorderCanvas();
    const display = createCanvasDisplaySink(
      canvas,
      () => 8,
      () => true,
    );

    display.print(0, 0, "AB", 1);

    expect(fillTexts.map((t) => t.text)).toEqual(["A", "B"]);
    expect(fillRects).toHaveLength(0); // text is not block-plotted in smooth mode
  });

  it("textWidth matches the firmware's chars × 6", () => {
    const { canvas } = recorderCanvas();
    const display = createCanvasDisplaySink(
      canvas,
      () => 1,
      () => false,
    );
    expect(display.textWidth("ABC")).toBe(18);
  });
});

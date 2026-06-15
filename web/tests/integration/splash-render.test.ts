import { describe, expect, test } from "vitest";
import { renderSplashFrame } from "@tool-ui/ui_splash.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
  return {
    fill_rect: (x: number, y: number, w: number, h: number, color: number) => calls.push(["fill", x, y, w, h, color]),
  };
}

describe("Splash render presentation", () => {
  test("decodes MSB-first pixels and coalesces horizontal runs", () => {
    const calls: DrawCall[] = [];
    renderSplashFrame(createDeps(calls), new Uint8Array([0b11110000]), 8, 1);

    expect(calls).toEqual([
      ["fill", 0, 0, 4, 1, 1],
    ]);
  });

  test("flushes a trailing row run", () => {
    const calls: DrawCall[] = [];
    renderSplashFrame(createDeps(calls), new Uint8Array([0b00000111]), 8, 1);

    expect(calls).toEqual([
      ["fill", 5, 0, 3, 1, 1],
    ]);
  });

  test("renders no calls for an empty frame", () => {
    const calls: DrawCall[] = [];
    renderSplashFrame(createDeps(calls), new Uint8Array([0, 0]), 8, 2);

    expect(calls).toEqual([]);
  });

  test("preserves row y coordinates across multiple rows", () => {
    const calls: DrawCall[] = [];
    renderSplashFrame(createDeps(calls), new Uint8Array([
      0b10000001,
      0b01111110,
      0b00011000,
    ]), 8, 3);

    expect(calls).toEqual([
      ["fill", 0, 0, 1, 1, 1],
      ["fill", 7, 0, 1, 1, 1],
      ["fill", 1, 1, 6, 1, 1],
      ["fill", 3, 2, 2, 1, 1],
    ]);
  });

  test("uses packed row bytes for wider frames", () => {
    const calls: DrawCall[] = [];
    renderSplashFrame(createDeps(calls), new Uint8Array([
      0b00000011, 0b11000000,
    ]), 16, 1);

    expect(calls).toEqual([
      ["fill", 6, 0, 4, 1, 1],
    ]);
  });
});

import { describe, expect, test } from "vitest";
import {
  renderSplashScreen,
  renderSplashAnimationFrame,
  SPLASH_TICKS_PER_FRAME,
  SPLASH_SETTLE_FRAME,
  SPLASH_LOOP_FRAMES,
  SPLASH_W,
  SPLASH_H,
} from "@overture-ui/render/ui_splash.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
  return {
    clear_screen: () => calls.push(["clear"]),
    fill_rect: (x: number, y: number, w: number, h: number, color: number) =>
      calls.push(["fill", x, y, w, h, color]),
  };
}

/** Reconstruct a 1-bit framebuffer from the emitted fill_rect runs. */
function fillsToBitmap(calls: DrawCall[]): Uint8Array {
  const bmp = new Uint8Array(SPLASH_W * SPLASH_H);
  for (const c of calls) {
    if (c[0] !== "fill") continue;
    const [, x, y, w, h] = c as ["fill", number, number, number, number, number];
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (xx >= 0 && xx < SPLASH_W && yy >= 0 && yy < SPLASH_H) bmp[yy * SPLASH_W + xx] = 1;
      }
    }
  }
  return bmp;
}

describe("Splash animation render", () => {
  test("emits only lit (color 1) horizontal runs within the 128x64 frame", () => {
    const calls: DrawCall[] = [];
    renderSplashAnimationFrame(createDeps(calls), 40);

    const fills = calls.filter((c) => c[0] === "fill");
    expect(fills.length).toBeGreaterThan(0);
    for (const [, x, y, w, h, color] of fills as [string, number, number, number, number, number][]) {
      expect(color).toBe(1);
      expect(h).toBe(1);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(SPLASH_W);
      expect(y).toBeLessThan(SPLASH_H);
    }
  });

  test("frame 0 is sparse; a mid-intro frame lights more pixels (animation progresses)", () => {
    const early: DrawCall[] = [];
    const mid: DrawCall[] = [];
    renderSplashAnimationFrame(createDeps(early), 0);
    renderSplashAnimationFrame(createDeps(mid), 30);

    const earlyLit = fillsToBitmap(early).reduce((a, b) => a + b, 0);
    const midLit = fillsToBitmap(mid).reduce((a, b) => a + b, 0);
    expect(midLit).toBeGreaterThan(earlyLit);
  });

  test("wordmark pixels appear by the reveal frame but not before it", () => {
    const before: DrawCall[] = [];
    const after: DrawCall[] = [];
    renderSplashAnimationFrame(createDeps(before), 10); // wordIn wipe maps frames 17..27
    renderSplashAnimationFrame(createDeps(after), 48);

    // The wordmark sits low on the display (y ~56). Count lit pixels in the
    // bottom rows as a proxy for the OVERTURE glyphs being present.
    const countBottom = (calls: DrawCall[]) => {
      const bmp = fillsToBitmap(calls);
      let n = 0;
      for (let y = 54; y < SPLASH_H; y++)
        for (let x = 0; x < SPLASH_W; x++) n += bmp[y * SPLASH_W + x];
      return n;
    };

    expect(countBottom(before)).toBe(0);
    expect(countBottom(after)).toBeGreaterThan(0);
  });

  test("settle phase loops seamlessly (frame N == frame N + loop period)", () => {
    const at = (f: number) => {
      const calls: DrawCall[] = [];
      renderSplashAnimationFrame(createDeps(calls), f);
      return JSON.stringify(calls);
    };
    // First loop frame and its repeat one full period later are pixel-identical.
    expect(at(SPLASH_SETTLE_FRAME)).toEqual(at(SPLASH_SETTLE_FRAME + SPLASH_LOOP_FRAMES));
    expect(at(SPLASH_SETTLE_FRAME + 5)).toEqual(at(SPLASH_SETTLE_FRAME + SPLASH_LOOP_FRAMES + 5));
  });

  test("renderSplashScreen clears first, then draws", () => {
    const calls: DrawCall[] = [];
    renderSplashScreen({ splashWasVisible: true, splashFrameTick: 30 * SPLASH_TICKS_PER_FRAME }, createDeps(calls));

    expect(calls[0]).toEqual(["clear"]);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[1][0]).toBe("fill");
  });

  test("entry edge resets the frame counter; subsequent ticks advance it", () => {
    const state: { splashWasVisible: boolean; splashFrameTick: number } = {
      splashWasVisible: false,
      splashFrameTick: 999,
    };
    renderSplashScreen(state, createDeps([]));
    expect(state.splashWasVisible).toBe(true);
    expect(state.splashFrameTick).toBe(0);

    renderSplashScreen(state, createDeps([]));
    expect(state.splashFrameTick).toBe(1);
  });

  test("animation frame advances once every SPLASH_TICKS_PER_FRAME ticks", () => {
    const within = (tick: number) => {
      const calls: DrawCall[] = [];
      renderSplashScreen({ splashWasVisible: true, splashFrameTick: tick }, createDeps(calls));
      return JSON.stringify(calls);
    };
    // Ticks inside the same frame window produce identical output.
    expect(within(30 * SPLASH_TICKS_PER_FRAME)).toEqual(within(30 * SPLASH_TICKS_PER_FRAME + 1));
    // Crossing into the next frame changes the output.
    expect(within(30 * SPLASH_TICKS_PER_FRAME)).not.toEqual(within(31 * SPLASH_TICKS_PER_FRAME));
  });
});

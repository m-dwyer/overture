import { describe, expect, test } from "vitest";
import { handleTrackViewCopyStepPress } from "@tool-ui/ui_track_view_step_workflow.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function deps(c: ReturnType<typeof calls>) {
  return {
    copyStep: c.fn("copyStep"),
    effectiveClip: c.fn("effectiveClip"),
    invalidateLEDCache: c.fn("invalidate"),
    forceRedraw: c.fn("redraw"),
  };
}

function state(overrides = {}) {
  return {
    copyHeld: true,
    copySrc: null,
    activeTrack: 2,
    trackCurrentPage: [0, 0, 3],
    ...overrides,
  };
}

describe("Track View Step Workflow", () => {
  test("Copy+first step captures a step source and invalidates LEDs", () => {
    const c = calls();
    const S = state();

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 53 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["invalidate"],
    ]);
  });

  test("Copy+second step copies source step to target step in the active clip", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "step", absStep: 50 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 8)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 50 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["copyStep", 2, 1, 50, 56],
      ["invalidate"],
      ["redraw"],
    ]);
  });

  test("Copy+same step does not copy but preserves refresh behavior", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "step", absStep: 53 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 53 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["invalidate"],
      ["redraw"],
    ]);
  });

  test("existing non-step copy source is swallowed and does not mix copy kinds", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "clip", track: 1, clip: 4 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "clip", track: 1, clip: 4 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
    ]);
  });

  test("plain step press is ignored by the Copy+step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(false);

    expect(S.copySrc).toBe(null);
    expect(c.log).toEqual([]);
  });
});

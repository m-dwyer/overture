import { describe, expect, test } from "vitest";
import { createOvertureCore } from "../../../overture-next/src/core/core";
import { createDefaultPattern } from "../../../overture-next/src/core/pattern";
import { createTracks } from "../../../overture-next/src/core/track";

describe("Overture Next core", () => {
  test("starts directly in the track view", () => {
    const core = createOvertureCore();
    core.init();

    const view = core.getView();
    expect(view.screen).toMatchObject({
      kind: "track",
      title: "OVERTURE NEXT",
      activeTrack: 0,
      playing: false,
      selectedStep: 0,
    });
  });

  test("dispatches transport, track selection, and step toggle as state changes", () => {
    const core = createOvertureCore();
    core.init();

    expect(core.applyInput({ kind: "play" })).toBe(true);
    expect(core.state.transport.playing).toBe(true);

    expect(core.applyInput({ kind: "shift", held: true })).toBe(true);
    expect(core.applyInput({ kind: "track-row", row: 1 })).toBe(true);
    expect(core.applyInput({ kind: "shift", held: false })).toBe(true);
    expect(core.state.activeTrack).toBe(5);

    expect(core.state.tracks[5].pattern.steps[1].active).toBe(false);
    expect(core.applyInput({ kind: "step", step: 1 })).toBe(true);
    expect(core.state.selectedStep).toBe(1);
    expect(core.state.tracks[5].pattern.steps[1].active).toBe(true);
  });

  test("emits Move note commands when the playhead reaches an active step", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "play" });
    core.applyInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.tick();

    expect(core.state.transport.playhead).toBe(1);
    expect(core.drainHostCommands()).toEqual([
      { kind: "track-note-on", trackIndex: 0, note: 61, velocity: 100 },
      { kind: "track-note-off", trackIndex: 0, note: 61 },
    ]);
    expect(core.drainHostCommands()).toEqual([]);
  });

  test("returns LED view data without touching a host adapter", () => {
    const core = createOvertureCore();
    core.init();

    const view = core.getView();
    expect(view.leds.steps.slice(0, 5)).toEqual([
      { step: 0, color: 120 },
      { step: 1, color: 0 },
      { step: 2, color: 0 },
      { step: 3, color: 0 },
      { step: 4, color: 48 },
    ]);
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 0, color: 120 });
  });

  test("creates a default pattern with per-step note data", () => {
    const pattern = createDefaultPattern();

    expect(pattern.length).toBe(16);
    expect(pattern.steps[0]).toMatchObject({ index: 0, active: true, note: 60, velocity: 100 });
    expect(pattern.steps[1]).toMatchObject({ index: 1, active: false, note: 61, velocity: 100 });
    expect(pattern.steps[4].active).toBe(true);
  });

  test("creates tracks with independent patterns", () => {
    const tracks = createTracks();

    expect(tracks).toHaveLength(8);
    expect(tracks[5]).toMatchObject({ index: 5, name: "Track 6" });
    tracks[0].pattern.steps[1].active = true;
    expect(tracks[1].pattern.steps[1].active).toBe(false);
  });

  test("wraps the transport playhead through the active track pattern length", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "play" });
    for (let i = 0; i < 12 * 16; i++) core.tick();

    expect(core.state.transport.playhead).toBe(0);
  });

  test("uses the active step note when emitting Move commands", () => {
    const core = createOvertureCore();
    core.init();

    core.state.tracks[0].pattern.steps[1].note = 72;
    core.applyInput({ kind: "play" });
    core.applyInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      { kind: "track-note-on", trackIndex: 0, note: 72, velocity: 100 },
      { kind: "track-note-off", trackIndex: 0, note: 72 },
    ]);
  });
});

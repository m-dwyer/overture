import type { CoreSnapshot } from "../core/types";
import { SESSION_PAD_COUNT, clipCellCoordinateForSessionPad } from "../session-grid";
import type { LedView, OvertureView, ScreenView } from "./types";

export function createOvertureView(snapshot: CoreSnapshot): OvertureView {
  return {
    screen: createScreenView(snapshot),
    leds: createLedView(snapshot),
  };
}

export function createScreenView(snapshot: CoreSnapshot): ScreenView {
  if (snapshot.sessionView) {
    return {
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: snapshot.selectedTrackIndex,
      selectedSceneIndex: snapshot.selectedClipCell.sceneIndex,
      selectedClipId: snapshot.selectedClipId,
      playing: snapshot.playing,
    };
  }

  return {
    kind: "track",
    title: "OVERTURE NEXT",
    selectedTrackIndex: snapshot.selectedTrackIndex,
    playing: snapshot.playing,
    selectedStep: snapshot.selectedStep,
    steps: snapshot.steps.map((step) => ({
      index: step.index,
      active: step.active,
      selected: step.selected,
      playhead: step.playhead,
    })),
  };
}

export function createLedView(snapshot: CoreSnapshot): LedView {
  const lowerTrack = snapshot.selectedTrackIndex % 4;
  return {
    steps: snapshot.steps.map((step) => ({
      step: step.index,
      color: step.playhead ? 120 : step.active ? 48 : 0,
    })),
    clipCellPads: createClipCellPadLedView(snapshot),
    buttons: [
      ...[0, 1, 2, 3].map((row) => ({ kind: "track-row" as const, row, color: row === lowerTrack ? 120 : 12 })),
      { kind: "play", color: snapshot.playing ? 16 : 4 },
      { kind: "menu", color: snapshot.sessionView ? 44 : 8 },
    ],
  };
}

function createClipCellPadLedView(snapshot: CoreSnapshot): LedView["clipCellPads"] {
  return Array.from({ length: SESSION_PAD_COUNT }, (_, padIndex) => {
    if (!snapshot.sessionView) return { padIndex, state: "off" };

    const coordinate = clipCellCoordinateForSessionPad(snapshot.visibleTrackBank, padIndex);
    const clipCell = snapshot.clipCells.find(
      (cell) => cell.trackIndex === coordinate.trackIndex && cell.sceneIndex === coordinate.sceneIndex,
    );
    const selected =
      snapshot.selectedClipCell.trackIndex === coordinate.trackIndex &&
      snapshot.selectedClipCell.sceneIndex === coordinate.sceneIndex;
    return {
      padIndex,
      state: selected ? "selected" : clipCell?.clipId ? "occupied" : "empty",
    };
  });
}

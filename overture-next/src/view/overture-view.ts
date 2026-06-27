import type { CoreSnapshot } from "../core/types";
import type { LedView, OvertureView, ScreenView } from "./types";

const TRACK_BANK_SIZE = 4;
const SESSION_SCENE_COLUMNS = 8;
const SESSION_PAD_COUNT = TRACK_BANK_SIZE * SESSION_SCENE_COLUMNS;

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

    const coordinate = clipCellCoordinateForPad(snapshot.visibleTrackBank, padIndex);
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

function clipCellCoordinateForPad(visibleTrackBank: number, padIndex: number): { trackIndex: number; sceneIndex: number } {
  const padRowFromBottom = Math.floor(padIndex / SESSION_SCENE_COLUMNS);
  const row = TRACK_BANK_SIZE - 1 - padRowFromBottom;
  return {
    trackIndex: row + visibleTrackBank * TRACK_BANK_SIZE,
    sceneIndex: padIndex % SESSION_SCENE_COLUMNS,
  };
}

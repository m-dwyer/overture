import type { Sequence, SequenceStep } from "../domain/sequence";
import { createDefaultSequence } from "../domain/sequence";
import { ClipEditor } from "./clip-editor";
import {
  clipCellCoordinate,
  clipId,
  type ClipCellCoordinate,
  type ClipCellCoordinateInput,
  type ClipId,
  createTracks,
  getTrack,
  SCENE_COUNT,
  type SceneIndex,
  sceneIndex,
  type Track,
  TRACK_COUNT,
  type TrackIndex,
  trackIndex,
  type TrackRoute,
} from "../domain/project";

export type {
  ClipCellCoordinate,
  ClipCellCoordinateInput,
  ClipId,
  SceneIndex,
  TrackIndex,
} from "../domain/project";

export interface ClipCellSnapshot {
  readonly trackIndex: TrackIndex;
  readonly sceneIndex: SceneIndex;
  readonly clipId: ClipId | null;
}

export interface SequenceStepSnapshot {
  readonly index: SequenceStep["index"];
  readonly active: boolean;
  readonly note: number;
  readonly velocity: number;
  readonly gateTicks: number;
}

export interface SequenceSnapshot {
  readonly length: number;
  readonly steps: readonly SequenceStepSnapshot[];
}

export interface OvertureClipSnapshot {
  readonly id: ClipId;
  readonly sequence: SequenceSnapshot;
}

interface OvertureScene {
  index: SceneIndex;
  name: string;
}

interface ClipCell {
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
  clipId: ClipId | null;
}

/**
 * An Overture Clip. Its Clip Cell Coordinate is intentionally not stored here:
 * a clip's location is derived from the Clip Cell that holds its Clip ID, which
 * is the single source of truth for occupancy. Do not re-add trackIndex/
 * sceneIndex fields; derive the coordinate from the owning Clip Cell instead.
 */
interface OvertureClip {
  id: ClipId;
  readonly sequence: Sequence;
}

interface OvertureProjectData {
  tracks: Track[];
  scenes: OvertureScene[];
  clipCells: ClipCell[];
  clips: Record<ClipId, OvertureClip>;
  nextClipNumber: number;
  selectedClipCell: ClipCellCoordinate;
}

/** Read-only Project contract for runtime playback resolution. */
export interface ProjectPlaybackReadModel {
  clipCellAt(coordinate: ClipCellCoordinateInput): ClipCellSnapshot;
  clipById(clipId: ClipId): OvertureClipSnapshot | null;
  trackRoute(trackIndexValue: number): TrackRoute;
}

/** Read-only Project contract for core snapshot/read-model projection. */
export interface ProjectCoreReadModel {
  clipCellAt(coordinate: ClipCellCoordinateInput): ClipCellSnapshot;
  sequenceFor(coordinate: ClipCellCoordinateInput): SequenceSnapshot | null;
  clipCellSnapshots(): readonly ClipCellSnapshot[];
  trackRoute(trackIndexValue: number): TrackRoute;
  trackColours(): readonly number[];
  selectedClipCell(): ClipCellCoordinate;
}

/**
 * The OvertureProject state owner: durable owner of Tracks, Overture Scenes,
 * Clip Cells, Overture Clips, and the Selected Clip Cell cursor (the active
 * clip). It keeps occupancy and identity state private and exposes read
 * contracts and scoped editors. A Clip Cell is the single source of truth for
 * clip location; the cursor names which clip is active for editing.
 */
export class OvertureProject {
  private readonly data: OvertureProjectData;

  private constructor(data: OvertureProjectData) {
    this.data = data;
  }

  static createDefault(): OvertureProject {
    return new OvertureProject(createDefaultProjectData());
  }

  /** Read-only occupancy at a coordinate. Throws when the coordinate is off-grid. */
  clipCellAt(coordinate: ClipCellCoordinateInput): ClipCellSnapshot {
    return snapshotCell(this.requireCell(coordinate));
  }

  /** The Overture Clip occupying a coordinate, or null for an Empty Clip Cell. */
  clipFor(coordinate: ClipCellCoordinateInput): OvertureClipSnapshot | null {
    const cell = this.requireCell(coordinate);
    if (!cell.clipId) return null;
    return snapshotClip(this.data.clips[cell.clipId]);
  }

  /** The Sequence owned by the clip at a coordinate, or null for an Empty Clip Cell. */
  sequenceFor(coordinate: ClipCellCoordinateInput): SequenceSnapshot | null {
    return this.clipFor(coordinate)?.sequence ?? null;
  }

  /** Resolves an Overture Clip by its Clip ID, or null when it no longer exists. */
  clipById(clipId: ClipId): OvertureClipSnapshot | null {
    return snapshotClip(this.data.clips[clipId]);
  }

  /** Copied Clip Cell occupancy for the whole grid, for read-only projections. */
  clipCellSnapshots(): readonly ClipCellSnapshot[] {
    return this.data.clipCells.map(snapshotCell);
  }

  /** A copy of the Track Route, so callers cannot mutate Project-owned route state. */
  trackRoute(trackIndexValue: number): TrackRoute {
    return { ...getTrack(this.data.tracks, trackIndex(trackIndexValue)).route };
  }

  /** Track Colour identity index for every Track, ordered by Track Index. */
  trackColours(): readonly number[] {
    return this.data.tracks.map((track) => track.colour);
  }

  /** The current Selected Clip Cell — the cursor over the grid naming the active clip. */
  selectedClipCell(): ClipCellCoordinate {
    return { ...this.data.selectedClipCell };
  }

  /**
   * Moves the cursor to a Clip Cell (the active clip). Validates the coordinate
   * is on-grid; selecting an Empty Clip Cell is allowed.
   */
  selectClip(coordinate: ClipCellCoordinateInput): void {
    this.data.selectedClipCell = clipCellCoordinate(coordinate);
  }

  /** Moves the cursor to a Track while preserving the current Overture Scene. */
  selectTrackKeepingScene(trackIndexValue: number): void {
    this.selectClip({
      trackIndex: trackIndexValue,
      sceneIndex: this.data.selectedClipCell.sceneIndex,
    });
  }

  /**
   * Vends a scoped {@link ClipEditor} for the active clip — the Overture Clip at
   * the Selected Clip Cell — or null when that cell is empty. Never exposes the
   * live Sequence; all Clip-content edits go through the returned editor.
   */
  activeClipEditor(): ClipEditor | null {
    const cell = this.requireCell(this.data.selectedClipCell);
    if (!cell.clipId) return null;
    const clip = this.data.clips[cell.clipId];
    if (!clip) return null;
    return ClipEditor.for(clip.sequence);
  }

  private requireCell(coordinate: ClipCellCoordinateInput): ClipCell {
    const cell = findClipCell(this.data.clipCells, coordinate);
    if (!cell)
      throw new Error(
        "Missing clip cell " +
          coordinate.trackIndex +
          ":" +
          coordinate.sceneIndex,
      );
    return cell;
  }
}

export function createDefaultProject(): OvertureProject {
  return OvertureProject.createDefault();
}

function snapshotCell(cell: ClipCell): ClipCellSnapshot {
  return {
    trackIndex: cell.trackIndex,
    sceneIndex: cell.sceneIndex,
    clipId: cell.clipId,
  };
}

function snapshotClip(
  clip: OvertureProjectData["clips"][ClipId] | undefined,
): OvertureClipSnapshot | null {
  if (!clip) return null;
  return {
    id: clip.id,
    sequence: snapshotSequence(clip.sequence),
  };
}

function snapshotSequence(sequence: Sequence): SequenceSnapshot {
  return {
    length: sequence.length,
    steps: sequence.steps.map(snapshotStep),
  };
}

function snapshotStep(step: SequenceStep): SequenceStepSnapshot {
  return {
    index: step.index,
    active: step.active,
    note: step.note,
    velocity: step.velocity,
    gateTicks: step.gateTicks,
  };
}

function createDefaultProjectData(): OvertureProjectData {
  const data: OvertureProjectData = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    nextClipNumber: 1,
    selectedClipCell: clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 }),
  };

  for (
    let trackIndexValue = 0;
    trackIndexValue < TRACK_COUNT;
    trackIndexValue++
  ) {
    createClipInCell(data, { trackIndex: trackIndexValue, sceneIndex: 0 });
  }

  return data;
}

function findClipCell(
  cells: readonly ClipCell[],
  coordinateInput: ClipCellCoordinateInput,
): ClipCell | undefined {
  const coordinate = clipCellCoordinate(coordinateInput);
  return cells.find(
    (cell) =>
      cell.trackIndex === coordinate.trackIndex &&
      cell.sceneIndex === coordinate.sceneIndex,
  );
}

function createScenes(sceneCount = SCENE_COUNT): OvertureScene[] {
  return Array.from({ length: sceneCount }, (_, index) => ({
    index: sceneIndex(index),
    name: "Scene " + (index + 1),
  }));
}

function createClipCells(
  trackCount = TRACK_COUNT,
  sceneCount = SCENE_COUNT,
): ClipCell[] {
  const clipCells: ClipCell[] = [];
  for (
    let sceneIndexValue = 0;
    sceneIndexValue < sceneCount;
    sceneIndexValue++
  ) {
    for (
      let trackIndexValue = 0;
      trackIndexValue < trackCount;
      trackIndexValue++
    ) {
      clipCells.push({
        trackIndex: trackIndex(trackIndexValue),
        sceneIndex: sceneIndex(sceneIndexValue),
        clipId: null,
      });
    }
  }
  return clipCells;
}

function createClipInCell(
  data: OvertureProjectData,
  coordinate: ClipCellCoordinateInput,
): OvertureClip {
  const cell = findClipCell(data.clipCells, coordinate);
  if (!cell)
    throw new Error(
      "Missing clip cell " +
        coordinate.trackIndex +
        ":" +
        coordinate.sceneIndex,
    );
  const clip = createOvertureClip(clipId("clip-" + data.nextClipNumber));
  data.nextClipNumber++;
  data.clips[clip.id] = clip;
  cell.clipId = clip.id;
  return clip;
}

function createOvertureClip(id: ClipId): OvertureClip {
  return {
    id,
    sequence: createDefaultSequence(),
  };
}

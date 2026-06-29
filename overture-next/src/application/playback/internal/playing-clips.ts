import type { OvertureClipSnapshot, ProjectPlaybackReadModel } from "../../../state/project";
import type { TrackPlaybackState } from "../state";

export function getPlayingClip(
  project: ProjectPlaybackReadModel,
  track: TrackPlaybackState,
): OvertureClipSnapshot | null {
  if (!track.playingClipId) return null;
  return project.clipById(track.playingClipId);
}

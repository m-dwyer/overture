import type { OvertureClip } from "../../../domain/project";
import type { OvertureProject } from "../../../state/project";
import type { TrackPlaybackState } from "../state";

export function getPlayingClip(project: OvertureProject, track: TrackPlaybackState): OvertureClip | null {
  if (!track.playingClipId) return null;
  return project.clipById(track.playingClipId);
}

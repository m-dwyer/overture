import type { HostCommand } from "../../host-commands";
import type { OvertureProject } from "../../project";
import { getSequenceStep } from "../../sequence";
import { getTrack } from "../../track";
import type { PlaybackState, ScheduledNoteOff } from "../state";
import { getPlayingClip } from "./playing-clips";

export function injectPlaybackStep(
  project: OvertureProject,
  playback: PlaybackState,
  step: number,
  tick: number,
): HostCommand[] {
  const hostCommands: HostCommand[] = [];
  for (const trackPlayback of playback.tracks) {
    const clip = getPlayingClip(project, trackPlayback);
    if (!clip) continue;
    const sequenceStep = getSequenceStep(clip.sequence, step % clip.sequence.length);
    if (!sequenceStep?.active) continue;
    const route = getTrack(project.tracks, trackPlayback.trackIndex).route;
    hostCommands.push({
      kind: "track-note-on",
      route,
      trackIndex: trackPlayback.trackIndex,
      note: sequenceStep.note,
      velocity: sequenceStep.velocity,
    });
    playback.pendingNoteOffs.push({
      dueTick: tick + Math.max(1, sequenceStep.gateTicks),
      route,
      trackIndex: trackPlayback.trackIndex,
      note: sequenceStep.note,
    });
  }
  return hostCommands;
}

export function drainDueNoteOffs(playback: PlaybackState, tick: number): HostCommand[] {
  const due: ScheduledNoteOff[] = [];
  const pending: ScheduledNoteOff[] = [];
  for (const noteOff of playback.pendingNoteOffs) {
    if (noteOff.dueTick <= tick) due.push(noteOff);
    else pending.push(noteOff);
  }
  playback.pendingNoteOffs = pending;
  return due.map(({ route, trackIndex, note }) => ({ kind: "track-note-off", route, trackIndex, note }));
}

export function drainPendingNoteOffsForTrack(playback: PlaybackState, trackIndex: number): HostCommand[] {
  const drained: ScheduledNoteOff[] = [];
  const kept: ScheduledNoteOff[] = [];
  for (const noteOff of playback.pendingNoteOffs) {
    if (noteOff.trackIndex === trackIndex) drained.push(noteOff);
    else kept.push(noteOff);
  }
  playback.pendingNoteOffs = kept;
  return drained.map(({ route, trackIndex: drainedTrackIndex, note }) => ({
    kind: "track-note-off",
    route,
    trackIndex: drainedTrackIndex,
    note,
  }));
}

import type { HostCommand } from "../../host-commands";

export interface ScheduledNoteOff {
  readonly dueTick: number;
  readonly emittedTarget: HostCommand["route"];
  readonly trackIndex: number;
  readonly note: number;
}

export class NoteGateScheduler {
  private pendingNoteOffs: ScheduledNoteOff[] = [];

  schedule(noteOff: ScheduledNoteOff): void {
    this.pendingNoteOffs.push(noteOff);
  }

  drainDue(tick: number): HostCommand[] {
    const due: ScheduledNoteOff[] = [];
    const pending: ScheduledNoteOff[] = [];
    for (const noteOff of this.pendingNoteOffs) {
      if (noteOff.dueTick <= tick) due.push(noteOff);
      else pending.push(noteOff);
    }
    this.pendingNoteOffs = pending;
    return due.map(toNoteOffCommand);
  }

  drainTrack(trackIndex: number): HostCommand[] {
    const drained: ScheduledNoteOff[] = [];
    const kept: ScheduledNoteOff[] = [];
    for (const noteOff of this.pendingNoteOffs) {
      if (noteOff.trackIndex === trackIndex) drained.push(noteOff);
      else kept.push(noteOff);
    }
    this.pendingNoteOffs = kept;
    return drained.map(toNoteOffCommand);
  }
}

export function createNoteGateScheduler(): NoteGateScheduler {
  return new NoteGateScheduler();
}

function toNoteOffCommand(noteOff: ScheduledNoteOff): HostCommand {
  return {
    kind: "track-note-off",
    route: noteOff.emittedTarget,
    trackIndex: noteOff.trackIndex,
    note: noteOff.note,
  };
}

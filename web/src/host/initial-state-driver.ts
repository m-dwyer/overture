import { CC, NAV, NOTE_OFF, NOTE_ON, ROW_CC } from "../lib/move-controls";
import type { Emulator } from "./emulator";

export interface InitialState {
  trackNumber: number | null;
  view: "note" | null;
}

export interface OvertureUiStateSnapshot {
  activeTrack?: number;
  selectedTrackIndex?: number;
  sessionView?: boolean;
}

export interface InitialStateDriverPort {
  clearInterval(timer: unknown): void;
  readOvertureRuntime(): { isReady(): boolean } | null;
  readOvertureUiState(): OvertureUiStateSnapshot | null;
  setInterval(callback: () => void, ms: number): unknown;
}

export function createGlobalInitialStateDriverPort(target: Window & typeof globalThis = window): InitialStateDriverPort {
  return {
    clearInterval(timer) {
      target.clearInterval(timer as number);
    },
    readOvertureRuntime() {
      return target.overtureRuntime ?? null;
    },
    readOvertureUiState() {
      return target.overtureUiState ?? null;
    },
    setInterval(callback, ms) {
      return target.setInterval(callback, ms);
    },
  };
}

export function scheduleInitialState(
  emu: Emulator,
  initialState: InitialState,
  port: InitialStateDriverPort = createGlobalInitialStateDriverPort(),
): () => void {
  const { trackNumber, view } = initialState;
  if ((trackNumber == null || trackNumber === 1) && view !== "note") return () => {};
  let attempts = 0;
  const timer = port.setInterval(() => {
    attempts++;
    const state = port.readOvertureUiState();
    const settled = state && port.readOvertureRuntime()?.isReady();
    if (!settled && attempts < 40) return;
    if (state && trackNumber != null && (readSelectedTrackIndex(state) | 0) !== trackNumber - 1) {
      applyInitialTrack(emu, trackNumber, !!state.sessionView);
    }
    const nextState = port.readOvertureUiState() ?? state;
    if (view === "note" && nextState?.sessionView) enterNoteView(emu);
    port.clearInterval(timer);
  }, 50);
  return () => port.clearInterval(timer);
}

function applyInitialTrack(emu: Emulator, trackNumber: number, sessionView = false): void {
  const trackIndex = trackNumber - 1;
  if (sessionView) {
    const note = 92 + trackIndex;
    emu.sendInternal(NOTE_ON, note, 110);
    emu.sendInternal(NOTE_OFF, note, 0);
    return;
  }
  const needsShift = trackIndex >= 4;
  const rowIndex = trackIndex % 4;
  if (needsShift) emu.sendInternal(CC, NAV.Shift, 127);
  emu.sendInternal(CC, ROW_CC[rowIndex], 127);
  emu.sendInternal(CC, ROW_CC[rowIndex], 0);
  if (needsShift) emu.sendInternal(CC, NAV.Shift, 0);
}

function enterNoteView(emu: Emulator): void {
  emu.sendInternal(CC, NAV.Menu, 127);
  emu.sendInternal(CC, NAV.Menu, 0);
}

function readSelectedTrackIndex(state: OvertureUiStateSnapshot): number {
  return state.selectedTrackIndex ?? state.activeTrack ?? 0;
}

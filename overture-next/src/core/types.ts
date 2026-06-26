export interface CoreState {
  bootSplashTicks: number;
  splashWasVisible: boolean;
  splashFrameTick: number;
  stateLoading: boolean;
  pendingSetLoad: boolean;
  pendingDspSync: number;
  ledInitComplete: boolean;
  activeTrack: number;
  sessionView: boolean;
  shiftHeld: boolean;
  playing: boolean;
  tick: number;
  playhead: number;
  selectedStep: number;
  pattern: boolean[];
  lastInjectedStep: number;
  touchedParam: null;
}

export interface SplashSurface {
  clear_screen(): void;
  fill_rect(x: number, y: number, width: number, height: number, color: number): void;
}

export interface OvertureHostAdapter {
  splashSurface: SplashSurface;
  publishState(state: CoreState): void;
  clear(): void;
  print(x: number, y: number, text: string, color: number): void;
  rect(x: number, y: number, width: number, height: number, color: number, fill: boolean): void;
  flush(): void;
  setLed(index: number, color: number): void;
  setButtonLed(cc: number, color: number): void;
  injectMoveNoteOn(track: number, note: number, velocity: number): void;
  injectMoveNoteOff(track: number, note: number): void;
}

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  handleMidi(data: readonly number[]): boolean;
}

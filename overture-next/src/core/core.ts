import type { CoreState, HostCommand, LedView, OvertureCore, OvertureView, ScreenView } from "./types";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CC = 0xb0;

const STEP_NOTE_FIRST = 16;
const STEP_COUNT = 16;
const ROW_CC = [43, 42, 41, 40] as const;

const CC_SHIFT = 49;
const CC_MENU = 50;
const CC_PLAY = 85;

const TICKS_PER_STEP = 12;
const BOOT_SPLASH_TICKS = 48;

export function createOvertureCore(): OvertureCore {
  const state: CoreState = {
    bootSplashTicks: BOOT_SPLASH_TICKS,
    splashWasVisible: false,
    splashFrameTick: 0,
    stateLoading: false,
    pendingSetLoad: false,
    pendingDspSync: 0,
    ledInitComplete: true,
    activeTrack: 0,
    sessionView: false,
    shiftHeld: false,
    playing: false,
    tick: 0,
    playhead: 0,
    selectedStep: 0,
    pattern: Array.from({ length: STEP_COUNT }, (_, i) => i % 4 === 0),
    lastInjectedStep: -1,
    touchedParam: null,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {
    state.bootSplashTicks = BOOT_SPLASH_TICKS;
    state.splashWasVisible = false;
    state.splashFrameTick = 0;
    state.stateLoading = false;
    state.pendingSetLoad = false;
    state.pendingDspSync = 0;
    state.ledInitComplete = true;
  }

  function tick(): void {
    if (state.bootSplashTicks > 0) {
      if (!state.splashWasVisible) {
        state.splashWasVisible = true;
        state.splashFrameTick = 0;
      } else {
        state.splashFrameTick++;
      }
      state.bootSplashTicks--;
    }
    if (state.playing) {
      state.tick++;
      if (state.tick % TICKS_PER_STEP === 0) {
        state.playhead = (state.playhead + 1) % STEP_COUNT;
        if (state.pattern[state.playhead]) injectStep(state.playhead);
      }
    }
  }

  function dispatchInput(data: readonly number[]): boolean {
    const status = (data[0] ?? 0) & 0xf0;
    const d1 = (data[1] ?? 0) | 0;
    const d2 = (data[2] ?? 0) | 0;
    if (status === CC) return handleCc(d1, d2);
    if ((status === NOTE_ON && d2 > 0) || status === NOTE_OFF || (status === NOTE_ON && d2 === 0)) {
      return handleNote(status, d1, d2);
    }
    return false;
  }

  function handleCc(cc: number, value: number): boolean {
    if (cc === CC_SHIFT) {
      state.shiftHeld = value > 0;
      return true;
    }
    if (value === 0) return false;
    if (cc === CC_PLAY) {
      state.playing = !state.playing;
      if (!state.playing) hostCommands.push({ kind: "move-note-off", track: state.activeTrack, note: 60 });
      return true;
    }
    if (cc === CC_MENU) {
      state.sessionView = !state.sessionView;
      return true;
    }
    const row = ROW_CC.indexOf(cc as (typeof ROW_CC)[number]);
    if (row >= 0) {
      state.activeTrack = row + (state.shiftHeld ? 4 : 0);
      return true;
    }
    return false;
  }

  function handleNote(status: number, note: number, velocity: number): boolean {
    if (status === NOTE_ON && velocity > 0 && note >= STEP_NOTE_FIRST && note < STEP_NOTE_FIRST + STEP_COUNT) {
      const step = note - STEP_NOTE_FIRST;
      state.selectedStep = step;
      state.pattern[step] = !state.pattern[step];
      return true;
    }
    return false;
  }

  function injectStep(step: number): void {
    const note = 60 + (step % 8);
    state.lastInjectedStep = step;
    hostCommands.push(
      { kind: "move-note-on", track: state.activeTrack, note, velocity: 100 },
      { kind: "move-note-off", track: state.activeTrack, note },
    );
  }

  function getView(): OvertureView {
    return {
      screen: getScreenView(),
      leds: getLedView(),
    };
  }

  function getScreenView(): ScreenView {
    if (state.bootSplashTicks > 0) {
      return {
        kind: "splash",
        splashWasVisible: state.splashWasVisible,
        splashFrameTick: state.splashFrameTick,
      };
    }
    state.splashWasVisible = false;
    return {
      kind: "track",
      title: "OVERTURE NEXT",
      mode: state.sessionView ? "session" : "track",
      activeTrack: state.activeTrack,
      playing: state.playing,
      selectedStep: state.selectedStep,
      steps: state.pattern.map((active, index) => ({
        index,
        active,
        selected: index === state.selectedStep,
        playhead: index === state.playhead,
      })),
    };
  }

  function getLedView(): LedView {
    const lowerTrack = state.activeTrack % 4;
    return {
      steps: state.pattern.map((active, i) => ({
        index: STEP_NOTE_FIRST + i,
        color: i === state.playhead ? 120 : active ? 48 : 0,
      })),
      buttons: [
        ...ROW_CC.map((cc, row) => ({ cc, color: row === lowerTrack ? 120 : 12 })),
        { cc: CC_PLAY, color: state.playing ? 16 : 4 },
        { cc: CC_MENU, color: state.sessionView ? 44 : 8 },
      ],
    };
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  return { state, init, tick, dispatchInput, getView, drainHostCommands };
}

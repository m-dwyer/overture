import { renderSplashScreen } from "../render/ui_splash.mjs";
import type { CoreState, OvertureCore, OvertureHostAdapter } from "./types";

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

export function createOvertureCore(adapter: OvertureHostAdapter): OvertureCore {
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

  function init(): void {
    state.bootSplashTicks = BOOT_SPLASH_TICKS;
    state.splashWasVisible = false;
    state.splashFrameTick = 0;
    state.stateLoading = false;
    state.pendingSetLoad = false;
    state.pendingDspSync = 0;
    state.ledInitComplete = true;
    adapter.publishState(state);
    draw();
  }

  function tick(): void {
    if (state.bootSplashTicks > 0) state.bootSplashTicks--;
    if (state.playing) {
      state.tick++;
      if (state.tick % TICKS_PER_STEP === 0) {
        state.playhead = (state.playhead + 1) % STEP_COUNT;
        if (state.pattern[state.playhead]) injectStep(state.playhead);
      }
    }
    adapter.publishState(state);
    draw();
  }

  function handleMidi(data: readonly number[]): boolean {
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
      if (!state.playing) adapter.injectMoveNoteOff(state.activeTrack, 60);
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
    adapter.injectMoveNoteOn(state.activeTrack, note, 100);
    adapter.injectMoveNoteOff(state.activeTrack, note);
  }

  function draw(): void {
    if (state.bootSplashTicks > 0) {
      renderSplashScreen(state, adapter.splashSurface);
      adapter.flush();
      return;
    }
    state.splashWasVisible = false;
    adapter.clear();
    adapter.print(0, 0, "OVERTURE NEXT", 1);
    adapter.print(0, 10, state.playing ? "PLAY" : "STOP", 1);
    adapter.print(42, 10, "T" + (state.activeTrack + 1), 1);
    adapter.print(72, 10, state.sessionView ? "SESSION" : "TRACK", 1);
    adapter.print(0, 22, "Clean core spike", 1);
    for (let i = 0; i < STEP_COUNT; i++) {
      const x = 2 + i * 7;
      const h = state.pattern[i] ? 7 : 3;
      const y = 54 - h;
      adapter.rect(x, y, 5, h, i === state.playhead ? 1 : state.pattern[i] ? 1 : 0, state.pattern[i] || i === state.playhead);
    }
    adapter.print(0, 56, "Step " + (state.selectedStep + 1), 1);
    adapter.flush();
    drawLeds();
  }

  function drawLeds(): void {
    for (let i = 0; i < STEP_COUNT; i++) {
      adapter.setLed(STEP_NOTE_FIRST + i, i === state.playhead ? 120 : state.pattern[i] ? 48 : 0);
    }
    for (let row = 0; row < ROW_CC.length; row++) {
      const lowerTrack = state.activeTrack % 4;
      adapter.setButtonLed(ROW_CC[row], row === lowerTrack ? 120 : 12);
    }
    adapter.setButtonLed(CC_PLAY, state.playing ? 16 : 4);
    adapter.setButtonLed(CC_MENU, state.sessionView ? 44 : 8);
  }

  return { state, init, tick, handleMidi };
}

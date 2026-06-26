import type { CoreInput } from "./input";
import { getPatternStep, togglePatternStep } from "./pattern";
import { createTracks, getTrack, selectTrackFromRow } from "./track";
import { advanceTransport, createTransport, toggleTransport } from "./transport";
import type { CoreState, HostCommand, LedView, OvertureCore, OvertureView, ScreenView } from "./types";

export function createOvertureCore(): OvertureCore {
  const tracks = createTracks();
  const state: CoreState = {
    stateLoading: false,
    pendingSetLoad: false,
    pendingDspSync: 0,
    ledInitComplete: true,
    activeTrack: 0,
    sessionView: false,
    shiftHeld: false,
    selectedStep: 0,
    transport: createTransport(),
    tracks,
    lastInjectedStep: -1,
    touchedParam: null,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {
    state.stateLoading = false;
    state.pendingSetLoad = false;
    state.pendingDspSync = 0;
    state.ledInitComplete = true;
  }

  function tick(): void {
    const track = activeTrack();
    const nextStep = advanceTransport(state.transport, track.pattern.length);
    if (nextStep !== null) {
      const step = getPatternStep(track.pattern, nextStep);
      if (step?.active) injectStep(nextStep);
    }
  }

  function applyInput(input: CoreInput): boolean {
    if (input.kind === "shift") {
      state.shiftHeld = input.held;
      return true;
    }
    if (input.kind === "play") {
      const playing = toggleTransport(state.transport);
      if (!playing) hostCommands.push({ kind: "move-note-off", track: activeTrack().route.channel, note: 60 });
      return true;
    }
    if (input.kind === "menu") {
      state.sessionView = !state.sessionView;
      return true;
    }
    if (input.kind === "track-row") {
      state.activeTrack = selectTrackFromRow(input.row, state.shiftHeld);
      return true;
    }
    if (input.kind === "step") {
      state.selectedStep = input.step;
      togglePatternStep(activeTrack().pattern, input.step);
      return true;
    }
    return false;
  }

  function injectStep(step: number): void {
    const patternStep = getPatternStep(activeTrack().pattern, step);
    if (!patternStep) return;
    state.lastInjectedStep = step;
    const track = activeTrack();
    hostCommands.push(
      { kind: "move-note-on", track: track.route.channel, note: patternStep.note, velocity: patternStep.velocity },
      { kind: "move-note-off", track: track.route.channel, note: patternStep.note },
    );
  }

  function getView(): OvertureView {
    return {
      screen: getScreenView(),
      leds: getLedView(),
    };
  }

  function getScreenView(): ScreenView {
    return {
      kind: "track",
      title: "OVERTURE NEXT",
      mode: state.sessionView ? "session" : "track",
      activeTrack: state.activeTrack,
      playing: state.transport.playing,
      selectedStep: state.selectedStep,
      steps: activeTrack().pattern.steps.map((step, index) => ({
        index,
        active: step.active,
        selected: index === state.selectedStep,
        playhead: index === state.transport.playhead,
      })),
    };
  }

  function getLedView(): LedView {
    const lowerTrack = state.activeTrack % 4;
    return {
      steps: activeTrack().pattern.steps.map((step, i) => ({
        step: i,
        color: i === state.transport.playhead ? 120 : step.active ? 48 : 0,
      })),
      buttons: [
        ...[0, 1, 2, 3].map((row) => ({ kind: "track-row" as const, row, color: row === lowerTrack ? 120 : 12 })),
        { kind: "play", color: state.transport.playing ? 16 : 4 },
        { kind: "menu", color: state.sessionView ? 44 : 8 },
      ],
    };
  }

  function activeTrack() {
    return getTrack(state.tracks, state.activeTrack);
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  return { state, init, tick, applyInput, getView, drainHostCommands };
}

import { createOvertureCore } from "../application/core";
import type {
  CoreSnapshot,
  OvertureCore,
  SurfaceHostReadModel,
} from "../application/types";
import { TRACK_VIEW_SOUND_PAGE_ID } from "../state/control-surface-context";
import type { OvertureHostPorts } from "../ports/host-ports";
import { renderLeds } from "../render/render-leds";
import { renderScreen } from "../render/render-screen";
import type { SplashScreenView } from "../render/types";
import { createOvertureSurfaceView } from "../view";

const BOOT_SPLASH_TICKS = 48;

export interface OvertureRuntime {
  init(): void;
  tickPlayback(): void;
  render(): void;
  tick(): void;
  onMidiMessage(data: readonly number[]): void;
  onUnload(): void;
  isReady(): boolean;
  isBootSplashVisible(): boolean;
  readonly debug: OvertureRuntimeDebug;
}

export interface OvertureRuntimeDebug {
  readonly core: OvertureCore;
}

export function createOvertureRuntime(
  hostPorts: OvertureHostPorts,
): OvertureRuntime {
  const core = createOvertureCore();
  let splashTicks = 0;
  let splashWasVisible = false;
  let splashFrameTick = 0;

  function init(): void {
    core.init();
    splashTicks = BOOT_SPLASH_TICKS;
    splashWasVisible = false;
    splashFrameTick = 0;
    render();
  }

  function tick(): void {
    tickPlayback();
    render();
  }

  function tickPlayback(): void {
    advanceSplash();
    core.advancePlaybackTick();
    drainCommands();
  }

  function onMidiMessage(data: readonly number[]): void {
    const input = hostPorts.inbound.controlSurface.parseMoveInput(
      data,
      core.selectedSequenceLength(),
    );
    if (input) core.dispatchControlInput(input);
    drainCommands();
  }

  function onUnload(): void {
    drainCommands();
    core.stopPlayback();
    drainCommands();
  }

  function isBootSplashVisible(): boolean {
    return splashTicks > 0;
  }

  function isReady(): boolean {
    return !isBootSplashVisible();
  }

  function advanceSplash(): void {
    if (splashTicks <= 0) return;
    if (!splashWasVisible) {
      splashWasVisible = true;
      splashFrameTick = 0;
    } else {
      splashFrameTick++;
    }
    splashTicks--;
  }

  function render(): void {
    const snapshot = core.snapshot();
    hostPorts.outbound.runtime.publishState(snapshot);
    const view = createOvertureSurfaceView(
      snapshot,
      createSurfaceHostReadModel(snapshot),
    );
    renderScreen(
      splashTicks > 0 ? getSplashView() : view.screen,
      hostPorts.outbound.display,
    );
    renderLeds(view.leds, hostPorts.outbound.leds);
  }

  function getSplashView(): SplashScreenView {
    return {
      kind: "splash",
      splashWasVisible,
      splashFrameTick,
    };
  }

  function drainCommands(): void {
    for (const command of core.drainHostCommands())
      hostPorts.outbound.commands.execute(command);
  }

  function createSurfaceHostReadModel(
    snapshot: CoreSnapshot,
  ): SurfaceHostReadModel {
    if (
      snapshot.activeView !== "track" ||
      snapshot.trackView.selectedPageId !== TRACK_VIEW_SOUND_PAGE_ID ||
      snapshot.selectedTrackRoute.kind !== "schwung"
    )
      return {};
    return {
      selectedSchwungChain:
        hostPorts.outbound.schwungChains?.readChain(
          snapshot.selectedTrackRoute.schwungChainIndex,
        ) ?? null,
    };
  }

  return {
    init,
    tickPlayback,
    render,
    tick,
    onMidiMessage,
    onUnload,
    isReady,
    isBootSplashVisible,
    debug: { core },
  };
}

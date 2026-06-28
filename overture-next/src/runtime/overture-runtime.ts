import { createOvertureCore } from "../core/core";
import type { OvertureCore } from "../core/types";
import type { OvertureHostPorts } from "../ports/host-ports";
import { renderLeds } from "../render/render-leds";
import { renderScreen } from "../render/render-screen";
import type { SplashScreenView } from "../render/types";
import { createOvertureView } from "../view/overture-view";

const BOOT_SPLASH_TICKS = 48;

export interface OvertureRuntime {
  readonly core: OvertureCore;
  init(): void;
  tickPlayback(): void;
  render(): void;
  tick(): void;
  onMidiMessage(data: readonly number[]): void;
  onUnload(): void;
  isReady(): boolean;
  isBootSplashVisible(): boolean;
}

export function createOvertureRuntime(hostPorts: OvertureHostPorts): OvertureRuntime {
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
    core.tick();
    drainCommands();
  }

  function onMidiMessage(data: readonly number[]): void {
    const input = hostPorts.inbound.controlSurface.parseMoveInput(data, core.getSelectedSequenceLength());
    if (input) core.applyInput(input);
    drainCommands();
  }

  function onUnload(): void {
    drainCommands();
    for (const command of core.stopPlayback()) hostPorts.outbound.commands.execute(command);
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
    const snapshot = core.getSnapshot();
    hostPorts.outbound.runtime.publishState(snapshot);
    const view = createOvertureView(snapshot);
    renderScreen(splashTicks > 0 ? getSplashView() : view.screen, hostPorts.outbound.display);
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
    for (const command of core.drainHostCommands()) hostPorts.outbound.commands.execute(command);
  }

  return { core, init, tickPlayback, render, tick, onMidiMessage, onUnload, isReady, isBootSplashVisible };
}

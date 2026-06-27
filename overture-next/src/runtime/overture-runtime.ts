import type { CoreInput } from "../core/input";
import { createOvertureCore } from "../core/core";
import type { OvertureCore } from "../core/types";
import type { OvertureHostAdapter } from "../host/types";
import { renderLeds } from "../render/render-leds";
import { renderScreen } from "../render/render-screen";
import type { SplashScreenView } from "../render/types";

const BOOT_SPLASH_TICKS = 48;

export interface OvertureRuntime {
  readonly core: OvertureCore;
  init(): void;
  tick(): void;
  onMidiMessage(data: readonly number[]): void;
  onUnload(): void;
  isReady(): boolean;
  isBootSplashVisible(): boolean;
}

export function createOvertureRuntime(adapter: OvertureHostAdapter): OvertureRuntime {
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
    advanceSplash();
    core.tick();
    drainCommands();
    render();
  }

  function onMidiMessage(data: readonly number[]): void {
    const input = adapter.input.parseMoveInput(data, core.getSelectedSequenceLength());
    if (input) applyInput(input);
    drainCommands();
  }

  function onUnload(): void {
    adapter.commands.execute({
      kind: "track-note-off",
      trackIndex: core.state.selectedTrackIndex,
      note: 60,
    });
  }

  function isBootSplashVisible(): boolean {
    return splashTicks > 0;
  }

  function isReady(): boolean {
    return !isBootSplashVisible();
  }

  function applyInput(input: CoreInput): void {
    core.applyInput(input);
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
    adapter.runtime.publishState(core.state);
    const view = core.getView();
    renderScreen(splashTicks > 0 ? getSplashView() : view.screen, adapter.display);
    renderLeds(view.leds, adapter.leds);
  }

  function getSplashView(): SplashScreenView {
    return {
      kind: "splash",
      splashWasVisible,
      splashFrameTick,
    };
  }

  function drainCommands(): void {
    for (const command of core.drainHostCommands()) adapter.commands.execute(command);
  }

  return { core, init, tick, onMidiMessage, onUnload, isReady, isBootSplashVisible };
}

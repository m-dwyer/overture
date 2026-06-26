import { createOvertureCore } from '../src/core/core.ts';
import { createSchwungAdapter } from '../src/host/schwung-adapter.ts';
import { renderLeds } from '../src/render/render-leds.ts';
import { renderScreen } from '../src/render/render-screen.ts';
import { installSchwungRuntime } from '../src/host/schwung-runtime.ts';

const adapter = createSchwungAdapter();
const core = createOvertureCore();

installSchwungRuntime({
  init() {
    core.init();
    render();
  },
  tick() {
    core.tick();
    drainCommands();
    render();
  },
  onMidiMessageInternal(data) {
    core.dispatchInput(data);
    drainCommands();
  },
  onMidiMessageExternal(data) {
    core.dispatchInput(data);
    drainCommands();
  },
  onUnload() {
    adapter.commands.execute({ kind: 'move-note-off', track: core.state.tracks[core.state.activeTrack].route.channel, note: 60 });
  },
}, {
  overtureNext: core,
  overtureUiState: core.state,
});

function drainCommands() {
    for (const command of core.drainHostCommands()) adapter.commands.execute(command);
}

function render() {
    adapter.runtime.publishState(core.state);
    const view = core.getView();
    renderScreen(view.screen, adapter.display);
    renderLeds(view.leds, adapter.leds);
}

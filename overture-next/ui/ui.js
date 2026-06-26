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
    dispatchMoveMidi(data);
  },
  onMidiMessageExternal(data) {
    dispatchMoveMidi(data);
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

function dispatchMoveMidi(data) {
    const input = adapter.input.parseMoveInput(data, activePatternLength());
    if (input) core.applyInput(input);
    drainCommands();
}

function activePatternLength() {
    return core.state.tracks[core.state.activeTrack].pattern.length;
}

function render() {
    adapter.runtime.publishState(core.state);
    const view = core.getView();
    renderScreen(view.screen, adapter.display);
    renderLeds(view.leds, adapter.leds);
}

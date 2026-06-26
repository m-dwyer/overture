import { createOvertureCore } from '../src/core/core.ts';
import { createSchwungAdapter } from '../src/host/schwung-adapter.ts';
import { renderLeds } from '../src/render/render-leds.ts';
import { renderScreen } from '../src/render/render-screen.ts';

const adapter = createSchwungAdapter();
const core = createOvertureCore();

globalThis.overtureNext = core;
globalThis.overtureUiState = core.state;

globalThis.init = function () {
    core.init();
    render();
};

globalThis.tick = function () {
    core.tick();
    drainCommands();
    render();
};

globalThis.onMidiMessageInternal = function (data) {
    core.dispatchInput(data || []);
    drainCommands();
};

globalThis.onMidiMessageExternal = function (data) {
    core.dispatchInput(data || []);
    drainCommands();
};

globalThis.onUnload = function () {
    adapter.injectMoveNoteOff(core.state.tracks[core.state.activeTrack].route.channel, 60);
};

function drainCommands() {
    for (const command of core.drainHostCommands()) adapter.execute(command);
}

function render() {
    adapter.publishState(core.state);
    const view = core.getView();
    renderScreen(view.screen, adapter);
    renderLeds(view.leds, adapter);
}

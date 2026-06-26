import { createOvertureCore } from '../src/core/core.ts';
import { createSchwungAdapter } from '../src/host/schwung-adapter.ts';

const adapter = createSchwungAdapter();
const core = createOvertureCore(adapter);

globalThis.overtureNext = core;
globalThis.overtureUiState = core.state;

globalThis.init = function () {
    core.init();
};

globalThis.tick = function () {
    core.tick();
};

globalThis.onMidiMessageInternal = function (data) {
    core.handleMidi(data || []);
};

globalThis.onMidiMessageExternal = function (data) {
    core.handleMidi(data || []);
};

globalThis.onUnload = function () {
    adapter.injectMoveNoteOff(core.state.activeTrack, 60);
};

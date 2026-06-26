import { createOvertureCore } from './core/overture_core.mjs';
import { createSchwungAdapter } from './host/schwung_adapter.mjs';

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

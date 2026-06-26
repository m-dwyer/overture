const CIN_NOTE_OFF = 0x08;
const CIN_NOTE_ON = 0x09;

export function createSchwungAdapter() {
    function call(name, args) {
        const fn = globalThis[name];
        if (typeof fn === 'function') return fn.apply(globalThis, args);
        return undefined;
    }

    function injectMovePacket(packet) {
        call('move_midi_inject_to_move', [packet]);
    }

    const adapter = {
        publishState(state) {
            globalThis.overtureUiState = state;
        },
        clear() {
            call('clear_screen', []);
        },
        print(x, y, text, color) {
            call('print', [x, y, text, color]);
        },
        rect(x, y, w, h, color, fill) {
            if (fill) call('fill_rect', [x, y, w, h, color]);
            else call('draw_rect', [x, y, w, h, color]);
        },
        flush() {
            call('host_flush_display', []);
        },
        setLed(index, color) {
            call('setLED', [index, color]);
        },
        setButtonLed(cc, color) {
            call('setButtonLED', [cc, color, true]);
        },
        injectMoveNoteOn(track, note, velocity) {
            injectMovePacket([(2 << 4) | CIN_NOTE_ON, 0x90 | (track & 0x0f), note & 0x7f, velocity & 0x7f]);
        },
        injectMoveNoteOff(track, note) {
            injectMovePacket([(2 << 4) | CIN_NOTE_OFF, 0x80 | (track & 0x0f), note & 0x7f, 0]);
        }
    };
    adapter.splashSurface = {
        clear_screen: () => adapter.clear(),
        fill_rect: (x, y, w, h, color) => call('fill_rect', [x, y, w, h, color])
    };
    return adapter;
}

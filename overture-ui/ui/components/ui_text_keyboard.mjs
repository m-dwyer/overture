const SCREEN_WIDTH = 128;
const TITLE_Y = 2;
const RULE_Y = 12;
const MODE_BADGE_W = 22;
const MODE_TEXT_X = MODE_BADGE_W + 4;
const GRID_START_X = 6;
const GRID_START_Y = 15;
const ROW_HEIGHT = 11;
const CHAR_WIDTH = 14;
const CHARS_PER_ROW = 8;

const PAD_NOTE_START = 68;
const PAD_NOTE_END = 99;
const PAD_COLOR_OFF = 0;
const PAD_COLOR_WHITE = 120;
const PAD_COLOR_HIGHLIGHT = 8;
const PAD_COLOR_PURPLE = 48;
const PAD_COLOR_BLUE = 44;
const PAD_COLOR_RED = 4;
const PAD_COLOR_GREEN = 16;
const MIDI_NOTE_ON = 0x90;

const CC_JOG_WHEEL = 14;
const CC_JOG_CLICK = 3;
const CC_BACK = 51;

const SPECIAL_ROW = 3;
const SPECIAL_COL_START = 3;
const SPECIAL_PAGE = 0;
const SPECIAL_SPACE = 1;
const SPECIAL_BACKSPACE = 2;
const SPECIAL_CONFIRM = 3;
const NUM_SPECIALS = 4;

const MAX_BUFFER_LENGTH = 512;
const SLIDE_GUARD_MS = 120;

const PAGES = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '1234567890.-!@#$%^&*',
    '\'";:?/\\<>()[]{}=-+'
];

const SYMBOL_NAMES = {
    '.': 'period', '-': 'dash', '!': 'exclamation', '@': 'at',
    '#': 'hash', '$': 'dollar', '%': 'percent', '^': 'caret',
    '&': 'ampersand', '*': 'asterisk', "'": 'apostrophe', '"': 'quote',
    ';': 'semicolon', ':': 'colon', '?': 'question mark', '/': 'slash',
    '\\': 'backslash', '<': 'less than', '>': 'greater than',
    '(': 'open paren', ')': 'close paren', '[': 'open bracket',
    ']': 'close bracket', '{': 'open brace', '}': 'close brace',
    '=': 'equals', '+': 'plus', ',': 'comma', '_': 'underscore'
};

export function normalizeTextKeyboardOptions(opts) {
    opts = opts || {};
    const defaultText = opts.defaultText !== undefined ? opts.defaultText : '';
    const initialText = opts.initialText !== undefined ? opts.initialText : defaultText;
    return {
        title: String(opts.title || ''),
        initialText: String(initialText || ''),
        padSelect: opts.padSelect !== undefined ? !!opts.padSelect : true,
        onConfirm: typeof opts.onConfirm === 'function' ? opts.onConfirm : null,
        onCancel: typeof opts.onCancel === 'function' ? opts.onCancel : null,
        onResult: typeof opts.onResult === 'function' ? opts.onResult : null
    };
}

function nowMs() {
    return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
}

function drawRect(deps, x, y, w, h, color) {
    deps.fill_rect(x, y, w, 1, color);
    deps.fill_rect(x, y + h - 1, w, 1, color);
    deps.fill_rect(x, y, 1, h, color);
    deps.fill_rect(x + w - 1, y, 1, h, color);
}

export function createTextKeyboard(deps) {
    deps = deps || {};
    const state = {
        active: false,
        title: '',
        buffer: '',
        selectedIndex: 0,
        page: 0,
        padSelect: true,
        onConfirm: null,
        onCancel: null,
        onResult: null
    };
    let currentHighlightPad = -1;
    let padLedSnapshot = {};
    let lastPadNote = -1;
    let pendingEntryNote = -1;
    let pendingEntryTime = 0;

    function chars() {
        return PAGES[state.page] || PAGES[0];
    }

    function sendPadLED(note, color) {
        if (typeof deps.moveMidiInternalSend === 'function')
            deps.moveMidiInternalSend([0x09, MIDI_NOTE_ON, note, color]);
    }

    function snapshotPadLEDs() {
        padLedSnapshot = {};
        if (typeof deps.getPadLedSnapshot !== 'function') return;
        const snap = deps.getPadLedSnapshot();
        if (!snap) return;
        for (let note = PAD_NOTE_START; note <= PAD_NOTE_END; note++) {
            const color = snap[String(note)];
            if (color !== undefined) padLedSnapshot[note] = color;
        }
    }

    function restorePadLEDs() {
        for (let note = PAD_NOTE_START; note <= PAD_NOTE_END; note++)
            sendPadLED(note, padLedSnapshot[note] || PAD_COLOR_OFF);
        currentHighlightPad = -1;
    }

    function padColToSpecial(padCol) {
        const sk = padCol - SPECIAL_COL_START;
        if (sk === 0) return SPECIAL_PAGE;
        if (sk === 1 || sk === 2) return SPECIAL_SPACE;
        if (sk === 3) return SPECIAL_BACKSPACE;
        if (sk === 4) return SPECIAL_CONFIRM;
        return -1;
    }

    function defaultPadColor(padNote) {
        const padIndex = padNote - PAD_NOTE_START;
        const padCol = padIndex % 8;
        const padRow = 3 - Math.floor(padIndex / 8);
        const charCount = chars().length;
        const gridIndex = padRow * CHARS_PER_ROW + padCol;
        if (padRow === SPECIAL_ROW) {
            if (padCol >= SPECIAL_COL_START) {
                const sk = padCol - SPECIAL_COL_START;
                if (sk === 0) return PAD_COLOR_PURPLE;
                if (sk === 1 || sk === 2) return PAD_COLOR_BLUE;
                if (sk === 3) return PAD_COLOR_RED;
                if (sk === 4) return PAD_COLOR_GREEN;
            }
            return gridIndex < charCount ? PAD_COLOR_WHITE : PAD_COLOR_OFF;
        }
        return gridIndex < charCount ? PAD_COLOR_WHITE : PAD_COLOR_OFF;
    }

    function setupPadLEDs() {
        currentHighlightPad = -1;
        for (let note = PAD_NOTE_START; note <= PAD_NOTE_END; note++)
            sendPadLED(note, defaultPadColor(note));
    }

    function selectPadItem(padNote) {
        const padIndex = padNote - PAD_NOTE_START;
        const padCol = padIndex % 8;
        const padRow = 3 - Math.floor(padIndex / 8);
        const charCount = chars().length;
        const gridIndex = padRow * CHARS_PER_ROW + padCol;
        if (padRow === SPECIAL_ROW) {
            if (padCol >= SPECIAL_COL_START) {
                const sp = padColToSpecial(padCol);
                if (sp >= 0) state.selectedIndex = charCount + sp;
            } else if (gridIndex < charCount) {
                state.selectedIndex = gridIndex;
            }
        } else if (gridIndex < charCount) {
            state.selectedIndex = gridIndex;
        }
    }

    function highlightPad(padNote) {
        if (currentHighlightPad === padNote) return;
        if (currentHighlightPad >= PAD_NOTE_START)
            sendPadLED(currentHighlightPad, defaultPadColor(currentHighlightPad));
        if (padNote >= PAD_NOTE_START && padNote <= PAD_NOTE_END)
            sendPadLED(padNote, PAD_COLOR_HIGHLIGHT);
        currentHighlightPad = padNote;
    }

    function close() {
        if (!state.active) return;
        if (state.padSelect) {
            restorePadLEDs();
            if (typeof deps.hostPadBlock === 'function') deps.hostPadBlock(0);
        }
        state.active = false;
        state.onConfirm = null;
        state.onCancel = null;
        state.onResult = null;
        pendingEntryNote = -1;
    }

    function selectedIsSpecial() {
        return state.selectedIndex >= chars().length;
    }

    function appendChar(ch) {
        if (state.buffer.length < MAX_BUFFER_LENGTH) state.buffer += ch;
    }

    function handleSelection() {
        const pageChars = chars();
        const charCount = pageChars.length;
        if (state.selectedIndex < charCount) {
            appendChar(pageChars[state.selectedIndex]);
            return;
        }
        const special = state.selectedIndex - charCount;
        if (special === SPECIAL_PAGE) {
            state.page = (state.page + 1) % PAGES.length;
            state.selectedIndex = chars().length + SPECIAL_PAGE;
            if (state.padSelect) setupPadLEDs();
        } else if (special === SPECIAL_SPACE) {
            appendChar(' ');
        } else if (special === SPECIAL_BACKSPACE) {
            if (state.buffer.length > 0) state.buffer = state.buffer.slice(0, -1);
        } else if (special === SPECIAL_CONFIRM) {
            const text = state.buffer;
            const onConfirm = state.onConfirm;
            const onResult = state.onResult;
            close();
            if (onResult) onResult({ action: 'confirm', text });
            if (onConfirm) onConfirm(text);
        }
    }

    function selectedLabel() {
        const pageChars = chars();
        if (state.selectedIndex < pageChars.length) {
            const ch = pageChars[state.selectedIndex];
            return SYMBOL_NAMES[ch] || ch;
        }
        const special = state.selectedIndex - pageChars.length;
        if (special === SPECIAL_PAGE) return 'page';
        if (special === SPECIAL_SPACE) return 'space';
        if (special === SPECIAL_BACKSPACE) return 'delete';
        if (special === SPECIAL_CONFIRM) return 'OK';
        return 'item';
    }

    function renderSpecialButtons(charCount) {
        const specialY = GRID_START_Y + 3 * ROW_HEIGHT;
        const buttons = [
            { label: 'Pg', width: 18 },
            { label: 'Spc', width: 24 },
            { label: 'Del', width: 20 },
            { label: 'OK', width: 18 }
        ];
        const totalWidth = buttons.reduce(function(sum, btn) { return sum + btn.width + 2; }, 0) - 2;
        let x = SCREEN_WIDTH - totalWidth - 2;
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const selected = state.selectedIndex === charCount + i;
            const btnTop = specialY + 2;
            const btnHeight = ROW_HEIGHT + 1;
            const labelX = x + Math.max(1, Math.floor((btn.width - btn.label.length * 6) / 2));
            const labelY = btnTop + 3;
            if (selected) {
                deps.fill_rect(x, btnTop, btn.width, btnHeight, 1);
                deps.print(labelX, labelY, btn.label, 0);
            } else {
                drawRect(deps, x, btnTop, btn.width, btnHeight, 1);
                deps.print(labelX, labelY, btn.label, 1);
            }
            x += btn.width + 2;
        }
    }

    return {
        open: function(opts) {
            const normalized = normalizeTextKeyboardOptions(opts);
            state.active = true;
            state.title = normalized.title;
            state.buffer = normalized.initialText.slice(0, MAX_BUFFER_LENGTH);
            state.selectedIndex = 0;
            state.page = 0;
            state.padSelect = normalized.padSelect;
            state.onConfirm = normalized.onConfirm;
            state.onCancel = normalized.onCancel;
            state.onResult = normalized.onResult;
            pendingEntryNote = -1;
            currentHighlightPad = -1;
            if (state.padSelect) {
                snapshotPadLEDs();
                if (typeof deps.hostPadBlock === 'function') deps.hostPadBlock(1);
                setupPadLEDs();
            }
            return true;
        },
        isActive: function() {
            return state.active;
        },
        render: function() {
            if (!state.active || typeof deps.clear_screen !== 'function') return false;
            deps.clear_screen();
            const bufferDisplay = state.buffer || '';
            const combined = state.title ? (state.title + ': ' + bufferDisplay) : bufferDisplay;
            const maxChars = Math.floor((SCREEN_WIDTH - MODE_TEXT_X - 2) / 6);
            const displayText = combined.length > maxChars ? '...' + combined.slice(-(maxChars - 3)) : combined;
            deps.fill_rect(0, 0, MODE_BADGE_W, 10, 1);
            deps.print(2, TITLE_Y, 'TXT', 0);
            deps.print(MODE_TEXT_X, TITLE_Y, displayText, 1);
            deps.fill_rect(0, RULE_Y, SCREEN_WIDTH, 1, 1);
            const pageChars = chars();
            for (let i = 0; i < pageChars.length; i++) {
                const row = Math.floor(i / CHARS_PER_ROW);
                const col = i % CHARS_PER_ROW;
                const x = GRID_START_X + col * CHAR_WIDTH;
                const y = GRID_START_Y + row * ROW_HEIGHT;
                if (i === state.selectedIndex) {
                    deps.fill_rect(x - 2, y - 1, CHAR_WIDTH - 2, ROW_HEIGHT, 1);
                    deps.print(x, y, pageChars[i], 0);
                } else {
                    deps.print(x, y, pageChars[i], 1);
                }
            }
            renderSpecialButtons(pageChars.length);
            return true;
        },
        handleMidi: function(msg) {
            if (!state.active) return false;
            const status = msg[0] & 0xF0;
            const data1 = msg[1] | 0;
            const data2 = msg[2] | 0;
            if (state.padSelect && status === 0x90 && data1 >= PAD_NOTE_START && data1 <= PAD_NOTE_END) {
                if (data2 === 0) return true;
                pendingEntryNote = -1;
                lastPadNote = data1;
                selectPadItem(data1);
                highlightPad(data1);
                if (data2 >= 31) {
                    if (selectedIsSpecial()) {
                        handleSelection();
                    } else {
                        pendingEntryNote = data1;
                        pendingEntryTime = nowMs();
                    }
                } else if (typeof deps.announce === 'function') {
                    deps.announce(selectedLabel() + ' selected');
                }
                return true;
            }
            if (status !== 0xB0) return false;
            if (data1 === CC_JOG_WHEEL) {
                const delta = typeof deps.decodeDelta === 'function' ? deps.decodeDelta(data2) : 0;
                if (delta !== 0) {
                    const total = chars().length + NUM_SPECIALS;
                    state.selectedIndex = Math.max(0, Math.min(total - 1, state.selectedIndex + delta));
                }
                return true;
            }
            if (data1 === CC_JOG_CLICK && data2 > 0) {
                handleSelection();
                return true;
            }
            if (data1 === CC_BACK && data2 > 0) {
                const onCancel = state.onCancel;
                const onResult = state.onResult;
                close();
                if (onResult) onResult({ action: 'cancel', text: null });
                if (onCancel) onCancel();
                return true;
            }
            return false;
        },
        tick: function() {
            if (!state.active) return false;
            if (pendingEntryNote >= 0 && (nowMs() - pendingEntryTime) >= SLIDE_GUARD_MS) {
                const note = pendingEntryNote;
                pendingEntryNote = -1;
                if (lastPadNote === note) {
                    selectPadItem(note);
                    handleSelection();
                    return true;
                }
            }
            return false;
        }
    };
}

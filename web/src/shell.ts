// Move hardware shell — clickable controls that emit the exact MIDI the device
// sends, into onMidiMessageInternal([status, d1, d2]). CC/note map is from the
// Schwung shared constants.mjs (the tool's own source of truth):
//   buttons/steps/knobs = CC (0xB0); pads = note 0x90/0x80 (68..99);
//   track buttons = CC 43..40 (Track 1..4); knobs = CC 71..78 (relative).
// The tool maps raw pad notes to musical notes internally (S.padNoteMap), so the
// shell only sends raw pad indices — no pad-layout logic needed here.
//
// mountShell() returns a ShellLeds controller so the host's setLED/setButtonLED/
// clearAllLEDs can paint the shell (steps via setLED 16..31, pads via setLED
// 68..99, buttons via setButtonLED by CC).
import { ledColor } from "./led-palette.js";

export type Send = (status: number, d1: number, d2: number) => void;

export interface ShellLeds {
  setLED(index: number, color: number): void;
  setButtonLED(cc: number, color: number): void;
  clearAll(): void;
}

const NOTE_ON = 0x90, NOTE_OFF = 0x80, CC = 0xb0;

// Control-change numbers (schwung/src/shared/constants.mjs).
const NAV = {
  Shift: 49, Menu: 50, Back: 51, Capture: 52, Down: 54, Up: 55, Undo: 56,
  Loop: 58, Copy: 60, Left: 62, Right: 63, Play: 85, Rec: 86, Mute: 88,
  Sample: 118, Delete: 119, JogClick: 3, JogRotate: 14,
};
const ROW_CC = [43, 42, 41, 40]; // Track 1..4 buttons
const STEP_CC0 = 16;             // Steps 1..16 -> CC 16..31
const KNOB_CC0 = 71;             // Encoders 1..8 -> CC 71..78 (relative)
const PAD_NOTE0 = 68;            // Pads 0..31 -> notes 68..99
const PAD_VELOCITY = 110;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function mountShell(root: HTMLElement, send: Send): ShellLeds {
  root.replaceChildren();

  const stepEls: HTMLElement[] = [];
  const padEls: HTMLElement[] = [];
  const buttonEls = new Map<number, HTMLElement>();

  /** A momentary CC button: 127 on press, 0 on release (matches hardware). */
  function momentary(label: string, cc: number, cls = "ctl"): HTMLButtonElement {
    const b = el("button", cls, label);
    const press = (e: Event) => { e.preventDefault(); b.classList.add("pressed"); send(CC, cc, 127); };
    const release = () => { if (b.classList.contains("pressed")) { b.classList.remove("pressed"); send(CC, cc, 0); } };
    b.addEventListener("pointerdown", press);
    b.addEventListener("pointerup", release);
    b.addEventListener("pointerleave", release);
    buttonEls.set(cc, b);
    return b;
  }

  /** A note button (pads + step buttons): note-on on press, note-off on release.
   *  Step buttons send NOTE 16..31 (not CC) — that's what _onStepButtons expects;
   *  CC 16..31 is only the LED address. */
  function noteButton(label: string, note: number, cls: string, vel = PAD_VELOCITY): HTMLButtonElement {
    const b = el("button", cls, label);
    const press = (e: Event) => { e.preventDefault(); b.classList.add("pressed"); send(NOTE_ON, note, vel); };
    const release = () => { if (b.classList.contains("pressed")) { b.classList.remove("pressed"); send(NOTE_OFF, note, 0); } };
    b.addEventListener("pointerdown", press);
    b.addEventListener("pointerup", release);
    b.addEventListener("pointerleave", release);
    return b;
  }

  /** A relative encoder: −/+ buttons (cw delta=1, ccw delta=127) + scroll wheel. */
  function encoder(idx: number): HTMLElement {
    const cc = KNOB_CC0 + idx;
    const wrap = el("div", "enc");
    wrap.appendChild(el("div", "enc-label", "K" + (idx + 1)));
    const row = el("div", "enc-row");
    const dec = el("button", "enc-btn", "−");
    const inc = el("button", "enc-btn", "+");
    dec.addEventListener("click", () => send(CC, cc, 127)); // ccw -1
    inc.addEventListener("click", () => send(CC, cc, 1));    // cw  +1
    row.append(dec, inc);
    wrap.appendChild(row);
    wrap.addEventListener("wheel", (e) => { e.preventDefault(); send(CC, cc, e.deltaY < 0 ? 1 : 127); }, { passive: false });
    return wrap;
  }

  // Encoders (8)
  const encRow = el("div", "row encoders");
  for (let i = 0; i < 8; i++) encRow.appendChild(encoder(i));
  root.appendChild(encRow);

  // Transport / navigation
  const nav = el("div", "row nav");
  for (const [label, cc] of [
    ["Shift", NAV.Shift], ["Menu", NAV.Menu], ["Back", NAV.Back], ["Capture", NAV.Capture],
    ["Undo", NAV.Undo], ["Loop", NAV.Loop], ["Copy", NAV.Copy], ["Delete", NAV.Delete],
    ["◀", NAV.Left], ["▶", NAV.Right], ["▲", NAV.Up], ["▼", NAV.Down],
    ["Play", NAV.Play], ["Rec", NAV.Rec], ["Mute", NAV.Mute], ["Sample", NAV.Sample],
  ] as const) {
    nav.appendChild(momentary(label, cc));
  }
  root.appendChild(nav);

  // Track buttons (4) + jog (rotate is relative; click is momentary)
  const trackRow = el("div", "row tracks");
  ROW_CC.forEach((cc, i) => trackRow.appendChild(momentary("Trk " + (i + 1), cc, "ctl track")));
  const jogDec = el("button", "ctl", "Jog −"); jogDec.addEventListener("click", () => send(CC, NAV.JogRotate, 127));
  const jogInc = el("button", "ctl", "Jog +"); jogInc.addEventListener("click", () => send(CC, NAV.JogRotate, 1));
  trackRow.append(jogDec, jogInc, momentary("Jog ●", NAV.JogClick));
  root.appendChild(trackRow);

  // Steps (16) — NOTE 16..31 on press; addressed by setLED(16..31) for LEDs.
  const stepRow = el("div", "row steps");
  for (let i = 0; i < 16; i++) {
    const b = noteButton(String(i + 1), STEP_CC0 + i, "ctl step", 127);
    stepEls[i] = b;
    stepRow.appendChild(b);
  }
  root.appendChild(stepRow);

  // Pads (4×8) — row 0 on top = indices 24..31, bottom row = 0..7
  const padGrid = el("div", "pads");
  for (let r = 3; r >= 0; r--) {
    for (let c = 0; c < 8; c++) {
      const idx = r * 8 + c;
      const b = noteButton(String(idx + 1), PAD_NOTE0 + idx, "pad");
      padEls[idx] = b;
      padGrid.appendChild(b);
    }
  }
  root.appendChild(padGrid);

  const paint = (e: HTMLElement | undefined, color: number) => { if (e) e.style.background = ledColor(color); };
  return {
    setLED(index, color) {
      if (index >= STEP_CC0 && index <= STEP_CC0 + 15) paint(stepEls[index - STEP_CC0], color);
      else if (index >= PAD_NOTE0 && index <= PAD_NOTE0 + 31) paint(padEls[index - PAD_NOTE0], color);
    },
    setButtonLED(cc, color) { paint(buttonEls.get(cc), color); },
    clearAll() {
      stepEls.forEach((e) => paint(e, 0));
      padEls.forEach((e) => paint(e, 0));
      buttonEls.forEach((e) => paint(e, 0));
    },
  };
}

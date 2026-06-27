// Computer-keyboard → device MIDI mapping for the emulator: Shift acts as the Shift
// nav button, number keys 1–0 act as Steps 1–10. Pulled out of App.tsx as a plain
// installer (adds window listeners, returns a disposer) so the mapping is testable
// without React; App wraps it in a useEffect.
import { CC, NAV, NOTE_OFF, NOTE_ON, STEP_CC0, type Send } from "../lib/move-controls";

const stepFromCode = (code: string): number | null => {
  if (/^Digit[1-9]$/.test(code)) return Number(code.slice(5));
  if (code === "Digit0") return 10;
  return null;
};

const targetIsEditable = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
};

/** Wire keyboard input to `send`; returns a disposer that releases held keys and
 *  removes the listeners. */
export function installKeyboardInput(send: Send): () => void {
  const held = new Set<string>();

  const onDown = (e: KeyboardEvent) => {
    if (targetIsEditable(e.target) || e.repeat || held.has(e.code)) return;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      held.add(e.code);
      send(CC, NAV.Shift, 127);
      return;
    }
    const step = stepFromCode(e.code);
    if (step !== null) {
      held.add(e.code);
      send(NOTE_ON, STEP_CC0 + step - 1, 127);
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent) => {
    if (!held.delete(e.code)) return;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      send(CC, NAV.Shift, 0);
      return;
    }
    const step = stepFromCode(e.code);
    if (step !== null) {
      send(NOTE_OFF, STEP_CC0 + step - 1, 0);
      e.preventDefault();
    }
  };
  const releaseAll = () => {
    for (const code of Array.from(held)) {
      held.delete(code);
      if (code === "ShiftLeft" || code === "ShiftRight") {
        send(CC, NAV.Shift, 0);
        continue;
      }
      const step = stepFromCode(code);
      if (step !== null) send(NOTE_OFF, STEP_CC0 + step - 1, 0);
    }
  };

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", releaseAll);
  return () => {
    releaseAll();
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", releaseAll);
  };
}

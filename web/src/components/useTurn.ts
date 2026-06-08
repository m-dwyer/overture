// Shared "rotary control" interaction for the encoders and the jog wheel. Turning
// is relative (like the hardware): every detent emits one tick. Three ways to turn:
//   • click-and-drag up/down (up = clockwise +1, down = −1) — the primary gesture
//   • mouse wheel / two-finger scroll while hovering
//   • the knob rotates `angle` degrees per tick for visual feedback
// The device's knobs are touch-sensitive; `onTouch` reports the capacitive-touch
// state so the shell can emit the knob-touch note (pointer down / mid-scroll = on).
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const STEP_PX = 7; // drag distance per detent
const DEG_PER_TICK = 18; // visual rotation per detent
const SCROLL_TOUCH_MS = 220; // how long after the last scroll the knob reads "released"

export function useTurn<T extends HTMLElement>(emit: (dir: 1 | -1) => void, onTouch?: (on: boolean) => void) {
  const [angle, setAngle] = useState(0);
  const ref = useRef<T>(null);
  const drag = useRef({ active: false, lastY: 0, acc: 0 });
  const scrollTouch = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tick = useCallback(
    (dir: 1 | -1) => {
      emit(dir);
      setAngle((a) => a + dir * DEG_PER_TICK);
    },
    [emit]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<T>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { active: true, lastY: e.clientY, acc: 0 };
      onTouch?.(true);
    },
    [onTouch]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      const d = drag.current;
      if (!d.active) return;
      d.acc += d.lastY - e.clientY; // dragging up (clientY ↓) turns clockwise
      d.lastY = e.clientY;
      while (d.acc >= STEP_PX) {
        d.acc -= STEP_PX;
        tick(1);
      }
      while (d.acc <= -STEP_PX) {
        d.acc += STEP_PX;
        tick(-1);
      }
    },
    [tick]
  );

  const end = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;
    onTouch?.(false);
  }, [onTouch]);

  // Wheel must be bound non-passively so it can swallow the page scroll. Scrolling
  // implies touching the knob, so pulse touch on and release it once scrolling stops.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (scrollTouch.current === undefined) onTouch?.(true);
      else clearTimeout(scrollTouch.current);
      scrollTouch.current = setTimeout(() => {
        scrollTouch.current = undefined;
        onTouch?.(false);
      }, SCROLL_TOUCH_MS);
      tick(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tick, onTouch]);

  return {
    angle,
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}

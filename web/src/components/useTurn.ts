// Shared "rotary control" interaction for the encoders and the jog wheel. Turning
// is relative (like the hardware): every detent emits one tick. Three ways to turn:
//   • click-and-drag up/down (up = clockwise +1, down = −1) — the primary gesture
//   • mouse wheel / two-finger scroll while hovering
//   • the knob rotates `angle` degrees per tick for visual feedback
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const STEP_PX = 7; // drag distance per detent
const DEG_PER_TICK = 18; // visual rotation per detent

export function useTurn<T extends HTMLElement>(emit: (dir: 1 | -1) => void) {
  const [angle, setAngle] = useState(0);
  const ref = useRef<T>(null);
  const drag = useRef({ active: false, lastY: 0, acc: 0 });

  const tick = useCallback(
    (dir: 1 | -1) => {
      emit(dir);
      setAngle((a) => a + dir * DEG_PER_TICK);
    },
    [emit]
  );

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { active: true, lastY: e.clientY, acc: 0 };
  }, []);

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
    drag.current.active = false;
  }, []);

  // Wheel must be bound non-passively so it can swallow the page scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tick(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [tick]);

  return {
    angle,
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}

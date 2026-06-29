// The big control wheel: drag up/down (or scroll) to rotate — relative CC 14 — with
// a notch on the rim that turns as you go. The centre is a momentary press (CC 3);
// its wrapper stops pointer events so pressing it doesn't start a wheel-drag.
import { useCallback } from "react";
import { CC, JOG_TOUCH, NAV, NOTE_ON, type Send } from "@/lib/move-controls";
import { MomentaryButton } from "./controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useTurn } from "./useTurn";

export function JogWheel({ send }: { send: Send }) {
  const emit = useCallback(
    (dir: 1 | -1) => send(CC, NAV.JogRotate, dir > 0 ? 1 : 127),
    [send],
  );
  const onTouch = useCallback(
    (on: boolean) => send(NOTE_ON, JOG_TOUCH, on ? 127 : 0),
    [send],
  );
  const { angle, ref, handlers } = useTurn<HTMLDivElement>(emit, onTouch);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          {...handlers}
          aria-label="Jog wheel"
          className="relative flex h-20 w-20 cursor-ns-resize touch-none select-none items-center justify-center rounded-full bg-gradient-to-b from-panel-2 to-bg border border-line shadow-inner"
        >
          {/* rotating rim notch — visual turn feedback */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <span className="absolute left-1/2 top-1.5 h-3 w-1 -translate-x-1/2 rounded-full bg-zinc-300" />
          </div>
          <div
            className="relative z-10"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MomentaryButton
              cc={NAV.JogClick}
              send={send}
              aria-label="Jog click"
              className="h-10 w-10 rounded-full bg-bg border border-line hover:border-muted"
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Wheel — drag up/down or scroll to turn, press centre to confirm
      </TooltipContent>
    </Tooltip>
  );
}

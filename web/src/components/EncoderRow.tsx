// The 8 top encoders (relative CC 71..78) + the master volume knob (CC 79). Turn by
// dragging up/down or scrolling; the knob's tick rotates. The device's knobs are
// touch-sensitive — pressing/scrolling a knob emits its capacitive-touch note
// (knobs 0..7, master = 8) so touch-gated gestures + Shift LED hints work.
import { useCallback } from "react";
import {
  CC,
  KNOB_CC0,
  KNOB_TOUCH0,
  MASTER_TOUCH,
  NOTE_ON,
  VOLUME_CC,
  type Send,
} from "@/lib/move-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useTurn } from "./useTurn";

const KNOB_BASE =
  "rounded-full bg-gradient-to-b from-panel-2 to-bg border border-line shadow-inner " +
  "relative after:absolute after:left-1/2 after:top-1 after:h-3 after:w-1 after:-translate-x-1/2 " +
  "after:rounded-full after:bg-zinc-300 hover:border-muted cursor-ns-resize touch-none select-none";

function Encoder({ idx, send }: { idx: number; send: Send }) {
  const cc = KNOB_CC0 + idx;
  const touch = KNOB_TOUCH0 + idx;
  const emit = useCallback((dir: 1 | -1) => send(CC, cc, dir > 0 ? 1 : 127), [cc, send]);
  const onTouch = useCallback((on: boolean) => send(NOTE_ON, touch, on ? 127 : 0), [touch, send]);
  const { angle, ref, handlers } = useTurn<HTMLButtonElement>(emit, onTouch);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          aria-label={`Encoder ${idx + 1}`}
          className={`h-12 w-12 ${KNOB_BASE}`}
          style={{ transform: `rotate(${angle}deg)` }}
          {...handlers}
        />
      </TooltipTrigger>
      <TooltipContent>Encoder {idx + 1} — drag up/down or scroll to turn</TooltipContent>
    </Tooltip>
  );
}

export function EncoderRow({ send }: { send: Send }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        {Array.from({ length: 8 }, (_, i) => (
          <Encoder key={i} idx={i} send={send} />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="w-12 text-center text-[9px] text-muted">
            K{i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export function VolumeKnob({ send }: { send: Send }) {
  const emit = useCallback((dir: 1 | -1) => send(CC, VOLUME_CC, dir > 0 ? 1 : 127), [send]);
  const onTouch = useCallback((on: boolean) => send(NOTE_ON, MASTER_TOUCH, on ? 127 : 0), [send]);
  const { angle, ref, handlers } = useTurn<HTMLButtonElement>(emit, onTouch);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          aria-label="Volume"
          className={`h-14 w-14 ${KNOB_BASE}`}
          style={{ transform: `rotate(${angle}deg)` }}
          {...handlers}
        />
      </TooltipTrigger>
      <TooltipContent>Output Volume — drag up/down or scroll</TooltipContent>
    </Tooltip>
  );
}

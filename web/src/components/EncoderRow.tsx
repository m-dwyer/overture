// The 8 top encoders (relative CC 71..78). Turn an encoder by dragging up/down
// (up = clockwise) or scrolling over it; the knob's tick mark rotates as you turn.
// `EncoderRow` is the row of 8 (sits above the pads); `VolumeKnob` is the separate
// master knob in the top-right corner (no CC in the device contract — decorative).
import { useCallback } from "react";
import { CC, KNOB_CC0, type Send } from "@/lib/move-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useTurn } from "./useTurn";

const KNOB =
  "h-12 w-12 rounded-full bg-gradient-to-b from-panel-2 to-bg border border-line shadow-inner " +
  "relative after:absolute after:left-1/2 after:top-1 after:h-3 after:w-1 after:-translate-x-1/2 " +
  "after:rounded-full after:bg-zinc-300 hover:border-muted cursor-ns-resize touch-none select-none";

function Encoder({ idx, send }: { idx: number; send: Send }) {
  const cc = KNOB_CC0 + idx;
  const emit = useCallback((dir: 1 | -1) => send(CC, cc, dir > 0 ? 1 : 127), [cc, send]);
  const { angle, ref, handlers } = useTurn<HTMLButtonElement>(emit);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          aria-label={`Encoder ${idx + 1}`}
          className={KNOB}
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

export function VolumeKnob() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label="Volume"
          className="h-14 w-14 rounded-full bg-gradient-to-b from-panel-2 to-bg border border-line shadow-inner cursor-pointer hover:border-muted"
        />
      </TooltipTrigger>
      <TooltipContent>Output Volume</TooltipContent>
    </Tooltip>
  );
}

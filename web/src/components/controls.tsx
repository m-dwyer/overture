// Low-level Move buttons. Both mirror the hardware exactly:
//   MomentaryButton — a CC control: value 127 on press, 0 on release.
//   NoteButton      — pads + steps: note-on on press, note-off on release.
// Press feedback is the `.pressed` class (toggled imperatively, no re-render) so it
// composes with the LED background the host paints onto the same element.
import type { PointerEvent, ReactNode, Ref } from "react";
import { CC, NOTE_OFF, NOTE_ON, type Send } from "@/lib/move-controls";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function press(e: PointerEvent<HTMLButtonElement>): void {
  e.preventDefault();
  e.currentTarget.classList.add("pressed");
}
function releasing(e: PointerEvent<HTMLButtonElement>): boolean {
  const el = e.currentTarget;
  if (!el.classList.contains("pressed")) return false;
  el.classList.remove("pressed");
  return true;
}

interface MomentaryProps {
  cc: number;
  send: Send;
  className?: string;
  children?: ReactNode;
  tooltip?: ReactNode;
  refCb?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
}

/** A momentary CC button (127 down / 0 up). Wrapped in a tooltip when given one. */
export function MomentaryButton({ cc, send, className, children, tooltip, refCb, ...rest }: MomentaryProps) {
  const btn = (
    <button
      ref={refCb}
      className={cn("select-none", className)}
      onPointerDown={(e) => {
        press(e);
        send(CC, cc, 127);
      }}
      onPointerUp={(e) => releasing(e) && send(CC, cc, 0)}
      onPointerLeave={(e) => releasing(e) && send(CC, cc, 0)}
      {...rest}
    >
      {children}
    </button>
  );
  if (!tooltip) return btn;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface NoteProps {
  note: number;
  vel: number;
  send: Send;
  className?: string;
  children?: ReactNode;
  refCb?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
}

/** A note button: note-on (vel) on press, note-off on release. Used by pads + steps. */
export function NoteButton({ note, vel, send, className, children, refCb, ...rest }: NoteProps) {
  return (
    <button
      ref={refCb}
      className={cn("select-none", className)}
      onPointerDown={(e) => {
        press(e);
        send(NOTE_ON, note, vel);
      }}
      onPointerUp={(e) => releasing(e) && send(NOTE_OFF, note, 0)}
      onPointerLeave={(e) => releasing(e) && send(NOTE_OFF, note, 0)}
      {...rest}
    >
      {children}
    </button>
  );
}

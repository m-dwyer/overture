// Low-level Move buttons. Both mirror the hardware exactly:
//   MomentaryButton — a CC control: value 127 on press, 0 on release.
//   NoteButton      — pads + steps: note-on on press, note-off on release.
// Press feedback is the `.pressed` class (toggled imperatively, no re-render) so it
// composes with the LED background the host paints onto the same element.
//
// `latch` makes a control toggle-and-hold instead of momentary: the hardware does
// chords by physically holding Shift while pressing another button, which is
// impossible with a single mouse pointer - so latched buttons stay held (CC 127)
// until clicked again (CC 0), letting you click other controls in between.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from "react";
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
  /** Toggle-and-hold instead of momentary (for modifier buttons like Shift). */
  latch?: boolean;
  /** Emulator-only: Alt-click toggles a physical hold for testing chords. */
  altHold?: boolean;
  "aria-label"?: string;
}

/** A CC button: momentary (127 down / 0 up) by default, or toggle-held when `latch`. */
export function MomentaryButton({ cc, send, className, children, tooltip, refCb, latch, altHold, ...rest }: MomentaryProps) {
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const toggle = (): void =>
    setHeld((h) => {
      send(CC, cc, h ? 0 : 127);
      return !h;
    });
  const togglePinned = (): void =>
    setPinned((h) => {
      const next = !h;
      pinnedRef.current = next;
      send(CC, cc, next ? 127 : 0);
      return next;
    });

  useEffect(() => {
    return () => {
      if (pinnedRef.current) send(CC, cc, 0);
    };
  }, [cc, send]);

  const btn = latch ? (
    <button
      ref={refCb}
      aria-pressed={held}
      className={cn("select-none", held && "pressed", className)}
      onClick={toggle}
      {...rest}
    >
      {children}
    </button>
  ) : (
    <button
      ref={refCb}
      aria-pressed={pinned || undefined}
      className={cn("select-none", pinned && "pressed", className)}
      onPointerDown={(e) => {
        if (altHold && e.altKey) {
          e.preventDefault();
          togglePinned();
          return;
        }
        if (pinned) {
          e.preventDefault();
          return;
        }
        press(e);
        send(CC, cc, 127);
      }}
      onPointerUp={(e) => !pinned && releasing(e) && send(CC, cc, 0)}
      onPointerLeave={(e) => !pinned && releasing(e) && send(CC, cc, 0)}
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

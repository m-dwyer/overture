// The 4 track-select buttons — rounded vertical pills down the left of the pad
// grid (top→bottom: Track 1..4 = blue/magenta/orange/green). Momentary CC 43..40.
// `self-stretch` + `flex-1` with the same gap as the pad grid makes the 4 pills
// line up exactly with the 4 pad rows. Unlit = dark (off) to match the device: the
// physical track LEDs are off by default; the tool lights them via setButtonLED
// (inline background, cleared to "" when off → reverts to this dark class).
import { ROW_CC, type Send } from "@/lib/move-controls";
import { cn } from "@/lib/utils";
import { MomentaryButton } from "./controls";
import { ledRef, useLedRegistry } from "./led-registry";

const UNLIT = "bg-[#1a1c18]";

export function TrackStrip({ send }: { send: Send }) {
  const reg = useLedRegistry();
  return (
    <div className="flex flex-col gap-1.5 self-stretch">
      {ROW_CC.map((cc, i) => (
        <MomentaryButton
          key={cc}
          cc={cc}
          send={send}
          tooltip={`Track ${i + 1}`}
          aria-label={`Track ${i + 1}`}
          refCb={ledRef(reg.buttons, cc)}
          className={cn("w-2.5 flex-1 rounded-full border border-line", UNLIT)}
        />
      ))}
    </div>
  );
}

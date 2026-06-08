// The 4 track-select buttons — rounded vertical pills down the left of the pad
// grid (top→bottom: Track 1..4 = blue/magenta/orange/green). Momentary CC 43..40.
// `self-stretch` + `flex-1` with the same gap as the pad grid makes the 4 pills
// line up exactly with the 4 pad rows. The unlit colour is a dim Tailwind class so
// the host's setButtonLED (inline background, cleared to "" when off) reverts to it.
import { ROW_CC, type Send } from "@/lib/move-controls";
import { cn } from "@/lib/utils";
import { MomentaryButton } from "./controls";
import { ledRef, useLedRegistry } from "./led-registry";

// Dim, saturated track tints for the unlit state.
const DIM = ["bg-[#1d2a6e]", "bg-[#5e1655]", "bg-[#5e2c12]", "bg-[#174a26]"];

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
          className={cn("w-2.5 flex-1 rounded-full border border-black/30", DIM[i])}
        />
      ))}
    </div>
  );
}

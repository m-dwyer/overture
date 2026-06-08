// The 16 step buttons along the bottom. They press as NOTE 16..31 (vel 127) — the
// `.step` class + Step 1 first are load-bearing for the e2e test. Each registers in
// the LED `steps` map by its index (16+i) so the host's setLED(16..31) lights it.
import { STEP_CC0, type Send } from "@/lib/move-controls";
import { NoteButton } from "./controls";
import { ledRef, useLedRegistry } from "./led-registry";

export function StepRow({ send }: { send: Send }) {
  const reg = useLedRegistry();
  return (
    <div className="flex justify-between gap-1.5">
      {Array.from({ length: 16 }, (_, i) => {
        const note = STEP_CC0 + i; // 16..31
        return (
          <NoteButton
            key={i}
            note={note}
            vel={127}
            send={send}
            aria-label={`Step ${i + 1}`}
            refCb={ledRef(reg.steps, note)}
            className="step h-8 w-8 rounded-full bg-panel-2 border border-line text-[9px] text-muted hover:border-muted"
          >
            {i + 1}
          </NoteButton>
        );
      })}
    </div>
  );
}

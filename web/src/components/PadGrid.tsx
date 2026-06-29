// The 4×8 pad grid. Pads send NOTE 68..99 (vel 110) on press / note-off on
// release. Row 0 (top) = indices 24..31, bottom row = 0..7 — matching the old
// shell's `for r=3..0, c=0..7, idx=r*8+c` so the host's setLED(68+idx) lights the
// right pad. Each pad registers in the LED `pads` map by its note.
import { PAD_NOTE0, PAD_VELOCITY, type Send } from "@/lib/move-controls";
import { NoteButton } from "./controls";
import { ledRef, useLedRegistry } from "./led-registry";

export function PadGrid({ send }: { send: Send }) {
  const reg = useLedRegistry();
  const pads = [];
  for (let r = 3; r >= 0; r--) {
    for (let c = 0; c < 8; c++) {
      const idx = r * 8 + c;
      const note = PAD_NOTE0 + idx;
      pads.push(
        <NoteButton
          key={idx}
          note={note}
          vel={PAD_VELOCITY}
          send={send}
          aria-label={`Pad ${idx + 1}`}
          refCb={ledRef(reg.pads, note)}
          className="aspect-[7/6] rounded-md bg-[#242a2f] border border-line hover:border-muted"
        />,
      );
    }
  }
  return <div className="grid w-full grid-cols-8 gap-1.5">{pads}</div>;
}

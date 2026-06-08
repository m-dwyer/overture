// The round icon buttons around the pad grid, grouped to match the Move panel:
//   BackMenu     — left of the pads: Back + Session/Note toggle.
//   Transport    — bottom-left: Play + Record (sits on the step-row line).
//   RightCluster — right of the pads: Capture/Sampling, Loop/Mute, Delete/Copy, Undo/Shift.
//   DPad         — bottom-right: Navigate-loop ‹ › and Octave up/down.
// Each is a momentary CC control (per the hardware map) that registers itself in
// the LED `buttons` map by CC so the host's setButtonLED can light it.
import type { ComponentType } from "react";
import {
  ArrowBigUp,
  Camera,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Menu,
  Mic,
  Minus,
  Play,
  Plus,
  Repeat,
  Trash2,
  Undo2,
  VolumeX,
} from "lucide-react";
import { NAV, type Send } from "@/lib/move-controls";
import { cn } from "@/lib/utils";
import { MomentaryButton } from "./controls";
import { ledRef, useLedRegistry } from "./led-registry";

// Backlit dark-plastic look: lit state comes from the host painting the element
// background; the icon stays light with a soft dark drop-shadow so it reads on any
// LED colour (yellow, blue, off).
const ROUND =
  "flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 border border-line " +
  "text-zinc-200 transition-colors hover:border-muted " +
  "[&_svg]:drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]";

interface Ctl {
  cc: number;
  label: string;
  Icon: ComponentType<{ size?: number | string; className?: string }>;
  className?: string;
}

function IconButton({ ctl, send, size = 16 }: { ctl: Ctl; send: Send; size?: number }) {
  const reg = useLedRegistry();
  return (
    <MomentaryButton
      cc={ctl.cc}
      send={send}
      tooltip={ctl.label}
      aria-label={ctl.label}
      refCb={ledRef(reg.buttons, ctl.cc)}
      className={cn(ROUND, ctl.className)}
    >
      <ctl.Icon size={size} />
    </MomentaryButton>
  );
}

const BACK_MENU: Ctl[] = [
  { cc: NAV.Back, label: "Back", Icon: ChevronLeft },
  { cc: NAV.Menu, label: "Toggle Session / Note", Icon: Menu },
];

export function BackMenu({ send }: { send: Send }) {
  return (
    <div className="flex gap-3">
      {BACK_MENU.map((c) => (
        <IconButton key={c.cc} ctl={c} send={send} />
      ))}
    </div>
  );
}

const TRANSPORT: Ctl[] = [
  { cc: NAV.Play, label: "Play", Icon: Play, className: "h-12 w-12 text-text" },
  { cc: NAV.Rec, label: "Record", Icon: Circle, className: "h-12 w-12 text-[#ff2020]" },
];

export function Transport({ send }: { send: Send }) {
  return (
    <div className="flex gap-3">
      {TRANSPORT.map((c) => (
        <IconButton key={c.cc} ctl={c} send={send} size={20} />
      ))}
    </div>
  );
}

// Right cluster, laid out as on the device (2 columns, top→bottom):
//   Capture  Sampling
//   Loop     Mute
//   Delete   Copy
//   Undo     Shift
const RIGHT: Ctl[] = [
  { cc: NAV.Capture, label: "Capture", Icon: Camera },
  { cc: NAV.Sample, label: "Sampling", Icon: Mic },
  { cc: NAV.Loop, label: "Loop", Icon: Repeat },
  { cc: NAV.Mute, label: "Mute", Icon: VolumeX },
  { cc: NAV.Delete, label: "Delete", Icon: Trash2 },
  { cc: NAV.Copy, label: "Copy", Icon: Copy },
  { cc: NAV.Undo, label: "Undo", Icon: Undo2 },
  { cc: NAV.Shift, label: "Shift", Icon: ArrowBigUp },
];

export function RightCluster({ send }: { send: Send }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {RIGHT.map((c) => (
        <IconButton key={c.cc} ctl={c} send={send} />
      ))}
    </div>
  );
}

// Bottom-right D-pad, arranged as a cross like the hardware: octave +/- vertical
// (Up/Down), navigate-loop ‹ › horizontal (Left/Right), centre empty. Smaller
// buttons than the cluster so the cross stays compact.
const DP = "h-8 w-8";
const OCT_UP: Ctl = { cc: NAV.Up, label: "Octave Up / Transpose", Icon: Plus, className: DP };
const OCT_DOWN: Ctl = { cc: NAV.Down, label: "Octave Down / Transpose", Icon: Minus, className: DP };
const NAV_LEFT: Ctl = { cc: NAV.Left, label: "Navigate ‹ / Nudge", Icon: ChevronLeft, className: DP };
const NAV_RIGHT: Ctl = { cc: NAV.Right, label: "Navigate › / Nudge", Icon: ChevronRight, className: DP };

export function DPad({ send }: { send: Send }) {
  // Column gap a touch larger than the row gap so the cross reads marginally wider
  // than tall (like the hardware) rather than vertically stretched.
  const blank = <span className={DP} aria-hidden />;
  return (
    <div className="grid w-max grid-cols-3 place-items-center gap-x-2 gap-y-1">
      {blank}
      <IconButton ctl={OCT_UP} send={send} size={15} />
      {blank}
      <IconButton ctl={NAV_LEFT} send={send} size={15} />
      {blank}
      <IconButton ctl={NAV_RIGHT} send={send} size={15} />
      {blank}
      <IconButton ctl={OCT_DOWN} send={send} size={15} />
      {blank}
    </div>
  );
}

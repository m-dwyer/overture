// The Move hardware panel. Lays out the controls spatially like the device (jog
// wheel upper-left, encoders across the top, pads centre with track strips, the
// round-icon cluster on the right, Play/Record + 16 steps along the bottom) and
// builds the imperative ShellLeds controller (same shape/behaviour as the old
// shell's: setLED routes steps 16..31 / pads 68..99, setButtonLED by CC, paint via
// element.style.background = ledColor(color)). The controller is handed up via
// onReady once refs are populated; LED colour never goes through React state.
import { useEffect, useMemo, useRef } from "react";
import type { LedSink } from "@/host/sinks.js";
import { ledColor } from "@/led-palette.js";
import { PAD_NOTE0, ROW_CC, STEP_CC0, type Send } from "@/lib/move-controls";
import { EncoderRow, VolumeKnob } from "./EncoderRow";
import { BackMenu, DPad, RightCluster, Transport } from "./ButtonClusters";
import { JogWheel } from "./JogWheel";
import { LedRegistryProvider, type LedRegistry } from "./led-registry";
import { PadGrid } from "./PadGrid";
import { StepRow } from "./StepRow";
import { TrackStrip } from "./TrackStrip";

export function Shell({
  send,
  onReady,
  heldControls = [],
}: {
  send: Send;
  onReady: (leds: LedSink) => void;
  heldControls?: readonly string[];
}) {
  const reg = useRef<LedRegistry>({
    steps: new Map(),
    pads: new Map(),
    buttons: new Map(),
  }).current;

  const controller = useMemo<LedSink>(() => {
    const reset = (el: HTMLElement): void => {
      el.style.background = "";
      el.style.borderColor = "";
      el.style.boxShadow = "";
      el.style.color = "";
    };
    // Pads / steps / track strips: a glossy lit surface that glows in its colour.
    const fill = (el: HTMLElement | undefined, color: number): void => {
      if (!el) return;
      if (color <= 0) return reset(el);
      const c = ledColor(color);
      el.style.background = `linear-gradient(180deg, color-mix(in srgb, ${c} 88%, white 12%), color-mix(in srgb, ${c} 76%, black 24%))`;
      el.style.borderColor = c;
      el.style.boxShadow = `inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -1px 3px rgba(0,0,0,0.22), 0 0 13px -4px ${c}`;
      el.style.color = "#111827";
    };
    // Round icon buttons: dark backlit plastic — a faint tint, a colour ring and a
    // soft outer glow, so the icon stays readable instead of a flat saturated disc.
    const glow = (el: HTMLElement | undefined, color: number): void => {
      if (!el) return;
      if (color <= 0) return reset(el);
      const c = ledColor(color);
      el.style.background = `linear-gradient(180deg, color-mix(in srgb, ${c} 38%, #2b3038), color-mix(in srgb, ${c} 22%, #161a20))`;
      el.style.borderColor = `color-mix(in srgb, ${c} 82%, white 8%)`;
      el.style.boxShadow = `inset 0 0 9px -2px ${c}, 0 0 14px -4px ${c}`;
      el.style.color = "#f8fafc";
    };
    const isTrack = (cc: number): boolean => (ROW_CC as readonly number[]).includes(cc);
    return {
      setLED(index, color) {
        if (index >= STEP_CC0 && index <= STEP_CC0 + 15) fill(reg.steps.get(index), color);
        else if (index >= PAD_NOTE0 && index <= PAD_NOTE0 + 31) fill(reg.pads.get(index), color);
      },
      setButtonLED(cc, color) {
        const el = reg.buttons.get(cc);
        if (isTrack(cc)) fill(el, color);
        else glow(el, color);
      },
      clearAll() {
        reg.steps.forEach(reset);
        reg.pads.forEach(reset);
        reg.buttons.forEach(reset);
      },
    };
  }, [reg]);

  useEffect(() => {
    onReady(controller);
  }, [controller, onReady]);

  return (
    <LedRegistryProvider value={reg}>
      {/* One grid for the whole panel: columns = [left ctrls | track | pads | right
          ctrls]. The pads and the 16 steps share column 3, so the steps line up
          exactly with the pad block's left and right edges. The left and right
          control columns span the pad + step rows and space their buttons top/bottom. */}
      <div
        id="shell"
        className="grid w-[940px] max-w-[94vw] gap-x-4 gap-y-4 overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-2xl"
        style={{ gridTemplateColumns: "auto auto 1fr 124px" }}
      >
        {/* row 1: encoders above the pads, master volume in the corner */}
        <div className="col-start-3 row-start-1">
          <EncoderRow send={send} />
        </div>
        <div className="col-start-4 row-start-1 flex items-center justify-center">
          <VolumeKnob send={send} />
        </div>

        {/* left controls: jog (top) / back+menu / play+record (bottom) */}
        <div className="col-start-1 row-start-2 row-end-4 flex flex-col items-center justify-between gap-4">
          <JogWheel send={send} />
          <BackMenu send={send} />
          <Transport send={send} />
        </div>

        {/* track strip + pads */}
        <div className="col-start-2 row-start-2 flex">
          <TrackStrip send={send} />
        </div>
        <div className="col-start-3 row-start-2">
          <PadGrid send={send} />
        </div>

        {/* right controls: icon cluster (top) / octave-nav cross (bottom) */}
        <div className="col-start-4 row-start-2 row-end-4 flex flex-col items-center justify-between gap-4">
          <RightCluster send={send} heldControls={heldControls} />
          <DPad send={send} />
        </div>

        {/* steps live under the pads only → same width as the pad block */}
        <div className="col-start-3 row-start-3">
          <StepRow send={send} />
        </div>
      </div>
    </LedRegistryProvider>
  );
}

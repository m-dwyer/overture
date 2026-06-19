// Root of the React emulator surface. Owns the boot/sink/render-loop logic ported
// from the old main.ts: it builds the canvas display sink, the LED sink (records
// maps + forwards to the shell controller), the localStorage file store, picks the
// DSP (real seq8-wasm, or the JS mock via ?mock), boots the emulator core, runs the
// ~94 Hz loop, and exposes globalThis.OVT. The host core stays untouched — this is
// just the browser binding, now expressed as React + an imperative effect.
import { useCallback, useEffect, useRef, useState } from "react";
import { createEmulator, type Emulator } from "@/host/emulator.js";
import type { DisplaySink, FileStore, LedSink } from "@/host/sinks.js";
import { createMockDsp } from "@/mock-dsp.js";
import { createWasmDsp } from "@/wasm-dsp.js";
import type { Dsp } from "@/dsp.js";
import type { Send } from "@/lib/move-controls";
import { OledScreen } from "./OledScreen";
import { Shell } from "./Shell";
import { TooltipProvider } from "./ui/tooltip";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9 ms)
const OLED_W = 128;
const OLED_H = 64;
// Real Move OLED: monochrome white pixels on black.
const FG = "#f2f2f2";
const BG = "#000000";
// The device's `print` font is a 5×7 bitmap on a fixed 6px-wide grid; the tool
// stacks menu rows only 9px apart (menu_layout LIST_LINE_HEIGHT) and right-aligns
// values using text_width = chars × 6. Match that so text doesn't overlap and
// alignment lands correctly. ~8px keeps glyphs inside the 9px line height.
const CHAR_W = 6;
const FONT = "8px ui-monospace, 'SF Mono', Menlo, monospace";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const emuRef = useRef<Emulator | null>(null);
  const shellLedsRef = useRef<LedSink | null>(null);
  const manualMode = new URLSearchParams(location.search).has("manual");
  const [manualGesture, setManualGesture] = useState("");
  const [manualControls, setManualControls] = useState("");
  const [manualShowing, setManualShowing] = useState("");

  // Records of LEDs the tool sets (for OVT + replay into the shell once it mounts).
  const ledsMap = useRef(new Map<number, number>()).current;
  const buttonLedsMap = useRef(new Map<number, number>()).current;

  // Stable handle to the emulator for the shell's button clicks (emu boots async).
  const send = useCallback<Send>((s, d1, d2) => emuRef.current?.sendInternal(s, d1, d2), []);

  // The shell hands up its imperative LED controller once its refs are populated.
  const onReady = useCallback(
    (leds: LedSink) => {
      shellLedsRef.current = leds;
      for (const [i, c] of ledsMap) leds.setLED(i, c);
      for (const [cc, c] of buttonLedsMap) leds.setButtonLED(cc, c);
    },
    [ledsMap, buttonLedsMap]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let logCount = 0;
    const log = (msg: string): void => {
      if (logCount++ > 500) return;
      const el = logRef.current;
      if (!el) return;
      el.textContent += msg + "\n";
      el.scrollTop = el.scrollHeight;
    };
    const setStatus = (m: string): void => {
      if (statusRef.current) statusRef.current.textContent = m;
    };

    // ---- Canvas display sink (1-bit OLED; value 0=black, 1=white → BG/FG) -------
    const shade = (v: number | boolean): string => (v ? FG : BG);
    // Mirror the current OLED frame's printed text into a global so tests can
    // assert what the screen actually says (e.g. the manual generator checks a
    // figure landed on "DELAY"/"STEP EDIT"). A draw-order join is enough for
    // substring checks; reset each frame on clearScreen. Same spirit as the
    // existing emulator test hooks — observability, not app logic.
    let oledFrame: string[] = [];
    const publishOled = () => {
      (globalThis as typeof globalThis & { __OVT_OLED_TEXT?: string }).__OVT_OLED_TEXT = oledFrame.join(" ");
    };
    const display: DisplaySink = {
      clearScreen() {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, OLED_W, OLED_H);
        oledFrame = [];
        publishOled();
      },
      fillRect(x, y, w, h, v) {
        ctx.fillStyle = shade(v);
        ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
      },
      drawRect(x, y, w, h, v) {
        ctx.fillStyle = shade(v);
        const X = x | 0,
          Y = y | 0,
          W = Math.max(0, w | 0),
          H = Math.max(0, h | 0);
        ctx.fillRect(X, Y, W, 1);
        ctx.fillRect(X, Y + H - 1, W, 1);
        ctx.fillRect(X, Y, 1, H);
        ctx.fillRect(X + W - 1, Y, 1, H);
      },
      setPixel(x, y, v) {
        ctx.fillStyle = shade(v);
        ctx.fillRect(x | 0, y | 0, 1, 1);
      },
      print(x, y, text, color) {
        ctx.font = FONT;
        ctx.textBaseline = "top";
        ctx.fillStyle = color === 0 ? BG : FG;
        // Draw on the device's fixed 6px-per-char grid (monospace, no kerning) so
        // spacing and text_width-based alignment match the firmware font.
        const s = String(text);
        const baseX = x | 0;
        const baseY = y | 0;
        for (let i = 0; i < s.length; i++) ctx.fillText(s[i], baseX + i * CHAR_W, baseY);
        if (s.trim()) { oledFrame.push(s); publishOled(); }
      },
      textWidth(text) {
        return String(text).length * CHAR_W;
      },
      flush() {
        /* drawn eagerly */
      },
    };

    // ---- LED sink → shell (records maps; forwards live once the shell is ready) -
    const ledSink: LedSink = {
      setLED(i, c) {
        ledsMap.set(i, c);
        shellLedsRef.current?.setLED(i, c);
      },
      setButtonLED(cc, c) {
        buttonLedsMap.set(cc, c);
        shellLedsRef.current?.setButtonLED(cc, c);
      },
      clearAll() {
        ledsMap.clear();
        buttonLedsMap.clear();
        shellLedsRef.current?.clearAll();
      },
    };

    // ---- File store → localStorage ---------------------------------------------
    const files: FileStore = {
      read: (p) => localStorage.getItem("ovt:" + p),
      write: (p, d) => {
        try {
          localStorage.setItem("ovt:" + p, String(d));
          return 1;
        } catch {
          return 0;
        }
      },
      exists: (p) => localStorage.getItem("ovt:" + p) !== null,
    };

    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    display.clearScreen();

    void (async () => {
      // Behavior tier: real seq8 engine unless ?mock is set.
      let dsp: Dsp = createMockDsp();
      if (!new URLSearchParams(location.search).has("mock")) {
        try {
          dsp = await createWasmDsp((tag, b0, b1, b2, b3) => log(`dsp→midi [${tag}] ${b0} ${b1} ${b2} ${b3}`));
          log("dsp: seq8-wasm (behavior tier)");
        } catch (e) {
          log("seq8-wasm load failed — using mock: " + ((e as Error)?.message || e));
        }
      }
      if (cancelled) return;

      let emu: Emulator;
      try {
        emu = await createEmulator({
          dsp,
          display,
          leds: ledSink,
          log,
          midi: {
            inject: (p) => log("inject_to_move " + JSON.stringify(p)),
            toChain: (a) => log("send_midi_to_dsp " + JSON.stringify(a)),
          },
          files,
        });
      } catch (e) {
        setStatus("FAILED to load tool ui.js");
        log("import error: " + ((e as Error)?.stack || e));
        return;
      }
      if (cancelled) return;
      emuRef.current = emu;

      try {
        emu.init();
      } catch (e) {
        log("init() threw: " + ((e as Error)?.stack || e));
      }

      // Replay any LEDs the tool set during init() into the shell controller.
      for (const [i, c] of ledsMap) shellLedsRef.current?.setLED(i, c);
      for (const [cc, c] of buttonLedsMap) shellLedsRef.current?.setButtonLED(cc, c);

      setStatus("running");
      let ticks = 0,
        lastRenderT = performance.now();
      interval = setInterval(() => {
        const now = performance.now();
        let blocks = Math.floor((now - lastRenderT) / BLOCK_MS);
        if (blocks > 16) {
          blocks = 16;
          lastRenderT = now;
        } else {
          lastRenderT += blocks * BLOCK_MS;
        }
        emu.renderBlocks(blocks);
        try {
          emu.tick();
        } catch (e) {
          if (ticks % 94 === 0) log("tick() threw: " + ((e as Error)?.message || e));
        }
        ticks++;
      }, 1000 / TICK_HZ);

      // Console-driven input handle (parity with the old shell).
      globalThis.OVT = {
        dsp,
        leds: ledsMap,
        buttonLeds: buttonLedsMap,
        midiIn: (s: number, d1: number, d2: number) => emu.sendInternal(s, d1, d2),
        midiExt: (s: number, d1: number, d2: number) => emu.sendExternal(s, d1, d2),
      };
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // Mount-once boot; all referenced values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!manualMode) return;
    const interval = setInterval(() => {
      setManualGesture(globalThis.__OVT_MANUAL_GESTURE ?? "");
      setManualControls(globalThis.__OVT_MANUAL_CONTROLS ?? "");
      setManualShowing(globalThis.__OVT_MANUAL_SHOWING ?? "");
    }, 100);
    return () => clearInterval(interval);
  }, [manualMode]);

  // The callout legend: numbered control names whose number + cyan match the
  // badges painted onto the controls (see tests/manual/annotate.ts).
  const legend: { n: number; name: string }[] = (() => {
    try {
      const parsed = JSON.parse(manualControls || "[]") as unknown;
      return Array.isArray(parsed) ? (parsed as { n: number; name: string }[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-[100dvh] w-full flex-col gap-3 p-4 font-mono">
        <h1 className={manualMode ? "sr-only" : "shrink-0 text-center text-xs font-semibold tracking-[0.2em] text-muted"}>
          OVERTURE — EMULATOR
        </h1>
        {/* Centring wrapper fills the viewport; the inner row stays the panel's
            natural height so only the left column is stretched to match it. On wide
            screens the screen + log sit beside the panel; they stack when narrow. */}
        <div className="flex flex-1 items-center justify-center">
          <div
            id={manualMode ? "manual-capture" : undefined}
            className="relative flex w-full flex-col items-center gap-6 min-[1360px]:w-auto min-[1360px]:flex-row min-[1360px]:items-stretch"
          >
            {/* Screen pinned at the top, log grows to fill so its bottom lines up
                with the bottom of the panel. */}
            <div className="flex w-[min(92vw,440px)] flex-col items-center gap-2">
              <OledScreen canvasRef={canvasRef} />
              <div id="status" ref={statusRef} className={manualMode ? "sr-only" : "min-h-[1.4em] shrink-0 text-xs text-accent"}>
                booting…
              </div>
              {/* The log is absolutely positioned inside a flex-filled wrapper so
                  its growing content can never inflate the column (which would
                  otherwise drag the panel taller via items-stretch) — it scrolls. */}
              <div className={manualMode ? "hidden" : "relative min-h-[180px] w-full flex-1"}>
                <pre
                  id="log"
                  ref={logRef}
                  className="absolute inset-0 overflow-auto rounded border border-line bg-black/60 p-2 text-[11px] leading-snug text-muted"
                />
              </div>
            </div>
            <Shell send={send} onReady={onReady} />
            {manualMode && (manualGesture || legend.length > 0 || manualShowing) ? (
              <div className="order-first w-[min(92vw,940px)] overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
                {/* Brand strip — guide-neutral: the generated doc supplies its own
                    title (beginner vs reference), so the in-figure banner only
                    carries the product brand, not a documentation label. */}
                <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-1.5">
                  <span className="text-[11px] font-bold tracking-[0.25em] text-accent">OVERTURE</span>
                </div>
                <div className="px-4 py-3 text-left">
                  {manualGesture ? (
                    <p className="text-[15px] font-semibold leading-snug text-text">
                      <span className="text-muted">Do:&nbsp;</span>
                      {manualGesture}
                    </p>
                  ) : null}
                  {legend.length > 0 ? (
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {legend.map((c) => (
                        <li
                          key={c.n}
                          className="flex items-center gap-1.5 rounded-full bg-panel-2 py-0.5 pl-0.5 pr-2.5 text-xs text-text"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#23d7ff] text-[11px] font-bold text-[#071013]">
                            {c.n}
                          </span>
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {manualShowing ? (
                    <p className="mt-2.5 text-xs leading-snug text-muted">
                      <span className="font-semibold text-text">Showing:&nbsp;</span>
                      {manualShowing}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

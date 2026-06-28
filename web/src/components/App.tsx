// Root of the React emulator surface. This is now just the view + lifecycle wiring:
// it owns the canvas/log/shell refs and the OLED readable⇄exact toggle, and an effect
// instantiates the browser host harness from the view-owned sinks. The browser
// binding logic lives in src/host/*; the host core stays untouched.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createBrowserEmulatorHarness,
  type BrowserEmulatorHarness,
  type BrowserHarnessDiagnostics,
} from "@/host/browser-emulator-harness";
import { createGlobalBrowserObservability } from "@/host/browser-observability";
import { createBrowserFileStore } from "@/host/browser-file-store.js";
import type { LedSink } from "@/host/sinks.js";
import { createCanvasDisplaySink, OLED_READABLE_SCALE } from "@/host/canvas-display-sink";
import { createShellLedSink } from "@/host/shell-led-sink";
import { installKeyboardInput } from "@/host/keyboard-input";
import type { Send } from "@/lib/move-controls";
import { OledScreen } from "./OledScreen";
import { SchwungDiagnosticsDrawer } from "./SchwungDiagnosticsDrawer";
import { Shell } from "./Shell";
import { TooltipProvider } from "./ui/tooltip";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const harnessRef = useRef<BrowserEmulatorHarness | null>(null);
  const shellLedsRef = useRef<LedSink | null>(null);
  const observabilityRef = useRef(createGlobalBrowserObservability());
  const searchParams = new URLSearchParams(location.search);
  const manualMode = searchParams.has("manual");
  const diagMode = searchParams.has("diag");
  const forceExactOled = searchParams.has("exact");
  const initialTrack = parseInitialTrack(searchParams.get("track"));
  const initialView = parseInitialView(searchParams.get("view"));
  // OLED readability: supersampled "readable" view by default, toggleable to a 1:1
  // pixel-exact view for verifying literal device pixels. `?exact` forces exact
  // (deterministic for snapshot tests); otherwise persisted in localStorage.
  const [readable, setReadable] = useState(() => {
    if (forceExactOled) return false;
    return localStorage.getItem("ovt:oled-readable") !== "0";
  });
  const oledScale = readable ? OLED_READABLE_SCALE : 1;
  // The display sink (built once in the boot effect) reads scale + smooth from this
  // ref, so toggling repaints at the new density / text path on the next tick without
  // a reboot. smooth = readable: "Sharp" anti-aliased text vs "Exact" 1-bit glyphs.
  const oledModeRef = useRef({ scale: oledScale, smooth: readable });
  useLayoutEffect(() => {
    oledModeRef.current.scale = oledScale;
    oledModeRef.current.smooth = readable;
    if (!forceExactOled) {
      localStorage.setItem("ovt:oled-readable", readable ? "1" : "0");
    }
  }, [readable, oledScale, forceExactOled]);

  const [manualGesture, setManualGesture] = useState("");
  const [manualControls, setManualControls] = useState("");
  const [manualShowing, setManualShowing] = useState("");
  const [schwungDiagnostics, setSchwungDiagnostics] = useState<BrowserHarnessDiagnostics | null>(null);

  // Records of LEDs the tool sets (for OVT + replay into the shell once it mounts).
  const ledsMap = useRef(new Map<number, number>()).current;
  const buttonLedsMap = useRef(new Map<number, number>()).current;

  // Stable handle to the emulator for the shell's button clicks (emu boots async).
  const send = useCallback<Send>((s, d1, d2) => {
    harnessRef.current?.send(s, d1, d2);
  }, []);

  useEffect(() => installKeyboardInput(send), [send]);

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
    if (!canvas) return;

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

    // Host binding: canvas → display sink (scale read live so the readable⇄exact
    // toggle takes effect on the next tick), recorded LED sink forwarding to the
    // shell once it mounts, and the localStorage-backed file store.
    const display = createCanvasDisplaySink(
      canvas,
      () => oledModeRef.current.scale,
      () => oledModeRef.current.smooth,
      observabilityRef.current
    );
    const leds: LedSink = createShellLedSink({
      ledsMap,
      buttonLedsMap,
      getShell: () => shellLedsRef.current,
    });
    const harness = createBrowserEmulatorHarness({
      host: {
        display,
        leds,
        files: createBrowserFileStore(localStorage),
        ledState: {
          padsAndSteps: ledsMap,
          buttons: buttonLedsMap,
        },
        manualMode,
        log,
        setStatus,
        notifyDiagnostics: setSchwungDiagnostics,
        harnessPort: observabilityRef.current,
      },
      initialState: {
        trackNumber: initialTrack,
        view: initialView,
      },
    });
    harnessRef.current = harness;
    void harness.start();

    return () => {
      harness.stop();
      if (harnessRef.current === harness) harnessRef.current = null;
    };
    // Mount-once boot; all referenced values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!manualMode) return;
    const interval = setInterval(() => {
      const annotation = observabilityRef.current.readManualAnnotation();
      setManualGesture(annotation.gesture);
      setManualControls(annotation.controls);
      setManualShowing(annotation.showing);
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
              <OledScreen canvasRef={canvasRef} scale={oledScale} smooth={readable} />
              <div className="flex w-full items-center justify-between gap-2">
                <div id="status" ref={statusRef} className={manualMode ? "sr-only" : "min-h-[1.4em] shrink-0 text-xs text-accent"}>
                  booting…
                </div>
                {manualMode ? null : (
                  <button
                    type="button"
                    onClick={() => setReadable((v) => !v)}
                    title="Toggle OLED rendering: Sharp = supersampled & readable, Exact = literal device pixels"
                    className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-text"
                  >
                    OLED: {readable ? "Sharp" : "Exact"}
                  </button>
                )}
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
            {diagMode ? (
              <SchwungDiagnosticsDrawer
                diagnostics={schwungDiagnostics}
                onReset={() => harnessRef.current?.resetSchwungAudio()}
              />
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function parseInitialTrack(value: string | null): number | null {
  if (!value) return null;
  const track = Number.parseInt(value, 10);
  return Number.isFinite(track) && track >= 1 && track <= 8 ? track : null;
}

function parseInitialView(value: string | null): "note" | null {
  return value === "note" ? "note" : null;
}

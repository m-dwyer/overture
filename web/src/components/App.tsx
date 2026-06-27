// Root of the React emulator surface. This is now just the view + lifecycle wiring:
// it owns the canvas/log/shell refs and the OLED readable⇄exact toggle, and an effect
// orchestrates the async boot by composing the host modules (display/LED sinks,
// keyboard input, DSP pick, tick loop, OVT handle). The browser-binding logic lives
// in src/host/*; the host core stays untouched.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createEmulator, type Emulator } from "@/host/emulator.js";
import { createBrowserFileStore } from "@/host/browser-file-store.js";
import type { LedSink } from "@/host/sinks.js";
import { createCanvasDisplaySink, OLED_READABLE_SCALE } from "@/host/canvas-display-sink";
import { createShellLedSink } from "@/host/shell-led-sink";
import { installKeyboardInput } from "@/host/keyboard-input";
import { installOvt, pickDsp, startTickLoop } from "@/host/emulator-runtime";
import { CC, NAV, NOTE_OFF, NOTE_ON, PAD_COUNT, PAD_NOTE0, ROW_CC, type Send } from "@/lib/move-controls";
import { type BrowserSchwungDiagnostics, type BrowserSchwungHost, createBrowserSchwungChain } from "@/schwung/browser-chain";
import { createManualSchwungChain } from "@/schwung/manual-catalog";
import { OledScreen } from "./OledScreen";
import { Shell } from "./Shell";
import { TooltipProvider } from "./ui/tooltip";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const emuRef = useRef<Emulator | null>(null);
  const shellLedsRef = useRef<LedSink | null>(null);
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
  const [schwungDiagnostics, setSchwungDiagnostics] = useState<BrowserSchwungDiagnostics | null>(null);
  const schwungRef = useRef<BrowserSchwungHost | null>(null);

  // Records of LEDs the tool sets (for OVT + replay into the shell once it mounts).
  const ledsMap = useRef(new Map<number, number>()).current;
  const buttonLedsMap = useRef(new Map<number, number>()).current;

  // Stable handle to the emulator for the shell's button clicks (emu boots async).
  const send = useCallback<Send>((s, d1, d2) => {
    if (shouldPrimeSchwungAudio(s, d1, d2)) schwungRef.current?.primeAudioEngine();
    emuRef.current?.sendInternal(s, d1, d2);
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
      () => oledModeRef.current.smooth
    );
    const leds: LedSink = createShellLedSink({
      ledsMap,
      buttonLedsMap,
      getShell: () => shellLedsRef.current,
    });
    const files = createBrowserFileStore(localStorage);

    let stopLoop: (() => void) | undefined;
    let stopInitialTrack: (() => void) | undefined;
    let cancelled = false;
    display.clearScreen();

    void (async () => {
      let schwung: BrowserSchwungHost;
      try {
        const schwungOptions = {
          log,
          notify: (diagnostics: BrowserSchwungDiagnostics) => setSchwungDiagnostics(diagnostics),
        };
        schwung = manualMode
          ? await createManualSchwungChain(schwungOptions)
          : await createBrowserSchwungChain(schwungOptions);
        schwungRef.current = schwung;
      } catch (e) {
        setStatus("FAILED to load Schwung modules");
        log("schwung load error: " + ((e as Error)?.stack || e));
        return;
      }

      const dsp = await pickDsp(log, schwung);
      if (cancelled) return;

      let emu: Emulator;
      try {
        emu = await createEmulator({
          dsp,
          display,
          leds,
          log,
          midi: {
            inject: (p) => log("inject_to_move " + JSON.stringify(p)),
            toChain: (a) => log("send_midi_to_dsp " + JSON.stringify(a)),
          },
          files,
          schwung,
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

      // Replay any LEDs the tool set during init() into an already-mounted shell.
      for (const [i, c] of ledsMap) shellLedsRef.current?.setLED(i, c);
      for (const [cc, c] of buttonLedsMap) shellLedsRef.current?.setButtonLED(cc, c);

      setStatus("running");
      stopLoop = startTickLoop(emu, log);
      stopInitialTrack = scheduleInitialState(emu, initialTrack, initialView);
      installOvt(emu, dsp, ledsMap, buttonLedsMap, schwung);
    })();

    return () => {
      cancelled = true;
      stopInitialTrack?.();
      stopLoop?.();
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
                onReset={() => schwungRef.current?.resetAudioEngine()}
              />
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function shouldPrimeSchwungAudio(status: number, d1: number, d2: number): boolean {
  const message = status & 0xf0;
  if (message === CC) return d1 === NAV.Play && d2 > 0;
  if (message !== NOTE_ON || d2 <= 0) return false;
  return d1 >= PAD_NOTE0 && d1 < PAD_NOTE0 + PAD_COUNT;
}

function parseInitialTrack(value: string | null): number | null {
  if (!value) return null;
  const track = Number.parseInt(value, 10);
  return Number.isFinite(track) && track >= 1 && track <= 8 ? track : null;
}

function parseInitialView(value: string | null): "note" | null {
  return value === "note" ? "note" : null;
}

function applyInitialTrack(emu: Emulator, trackNumber: number | null, sessionView = false): void {
  if (trackNumber == null || trackNumber === 1) return;
  const trackIndex = trackNumber - 1;
  if (sessionView) {
    const note = 92 + trackIndex;
    emu.sendInternal(NOTE_ON, note, 110);
    emu.sendInternal(NOTE_OFF, note, 0);
    return;
  }
  const needsShift = trackIndex >= 4;
  const rowIndex = trackIndex % 4;
  if (needsShift) emu.sendInternal(CC, NAV.Shift, 127);
  emu.sendInternal(CC, ROW_CC[rowIndex], 127);
  emu.sendInternal(CC, ROW_CC[rowIndex], 0);
  if (needsShift) emu.sendInternal(CC, NAV.Shift, 0);
}

function enterNoteView(emu: Emulator): void {
  emu.sendInternal(CC, NAV.Menu, 127);
  emu.sendInternal(CC, NAV.Menu, 0);
}

function scheduleInitialState(emu: Emulator, trackNumber: number | null, view: "note" | null): () => void {
  if ((trackNumber == null || trackNumber === 1) && view !== "note") return () => {};
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts++;
    const state = readOvertureUiState();
    const settled = state && readOvertureRuntime()?.isReady();
    if (!settled && attempts < 40) return;
    if (state && trackNumber != null && (readSelectedTrackIndex(state) | 0) !== trackNumber - 1) {
      applyInitialTrack(emu, trackNumber, !!state.sessionView);
    }
    const nextState = readOvertureUiState() ?? state;
    if (view === "note" && nextState?.sessionView) enterNoteView(emu);
    window.clearInterval(timer);
  }, 50);
  return () => window.clearInterval(timer);
}

function readOvertureUiState(): {
  activeTrack?: number;
  selectedTrackIndex?: number;
  sessionView?: boolean;
} | null {
  const state = (globalThis as {
    overtureUiState?: {
      activeTrack?: number;
      selectedTrackIndex?: number;
      sessionView?: boolean;
    };
  }).overtureUiState;
  return state ?? null;
}

function readSelectedTrackIndex(state: { activeTrack?: number; selectedTrackIndex?: number }): number {
  return state.selectedTrackIndex ?? state.activeTrack ?? 0;
}

function readOvertureRuntime(): { isReady(): boolean } | null {
  return (globalThis as { overtureRuntime?: { isReady(): boolean } }).overtureRuntime ?? null;
}

function SchwungDiagnosticsDrawer({
  diagnostics,
  onReset,
}: {
  diagnostics: BrowserSchwungDiagnostics | null;
  onReset(): void;
}) {
  const diag = diagnostics ?? { errors: [], midi: [], params: [], slots: [], worklet: {} };
  return (
    <aside className="w-[min(92vw,440px)] rounded border border-line bg-black/70 p-3 text-left text-[11px] text-muted">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-accent">SCHWUNG AUDIO</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-line px-2 py-0.5 text-[11px] text-text hover:border-accent"
        >
          Reset
        </button>
      </div>
      <DiagBlock title="Chain" rows={diag.slots.map((slot) =>
        `${slot.name} ch${slot.channel}: ${slot.midiFx || "--"} > ${slot.synth || "--"} > ${slot.fx1 || "--"} > ${slot.fx2 || "--"}`
      )} />
      <DiagBlock title="Worklet" rows={Object.entries(diag.worklet).map(([slot, state]) => `${slot}: ${state}`)} />
      <DiagBlock title="Params" rows={diag.params.map((item) => `S${item.slot + 1} ${item.key}=${item.value}`)} />
      <DiagBlock title="MIDI" rows={diag.midi.map((item) =>
        `S${item.slot + 1} ${item.direction} ${item.status.toString(16)} ${item.d1} ${item.d2}`
      )} />
      <DiagBlock title="Errors" rows={diag.errors.map((item) => `${item.slotId}: ${item.message}`)} />
    </aside>
  );
}

function DiagBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="mt-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text">{title}</h3>
      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-black/50 p-2 leading-snug">
        {rows.length ? rows.join("\n") : "--"}
      </pre>
    </section>
  );
}

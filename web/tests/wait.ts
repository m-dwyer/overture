import type { Page } from "@playwright/test";

// Determinism primitives for the emulator tests. The OLED is drawn by a free-running
// ~94 Hz tick loop (App.tsx): injected MIDI updates UI state synchronously, but the
// dirty-gated redraw (and any two-tick-deferred display work) is flushed by the loop
// a tick or two later. Under load that loop starves, so a screenshot taken on a fixed
// timer can race it and capture a stale/intermediate frame. Instead of waiting on the
// wall clock, we OWN the clock: after injecting input, synchronously advance the
// device the exact number of ticks the effect needs, then assert. No sleeps, no
// stabilization polling — the screen becomes a pure function of ticks advanced.

type OvtGlobal = typeof globalThis & {
  OVT?: { advanceTicks(n: number): void };
  overtureRuntime?: { isBootSplashVisible(): boolean };
  overtureUiState?: { stateLoading?: boolean };
};

// Boot is complete and interactive: the tool handle exists, persisted state has
// loaded, and the boot splash has finished. The one true "page is ready" gate —
// replaces every "sleep ~2500ms past the splash". (Boot itself is driven by the
// real loop, so this still waits on an observable condition rather than ticks.)
export function waitReady(page: Page): Promise<unknown> {
  return page.waitForFunction(() => {
    const g = globalThis as OvtGlobal;
    const s = g.overtureUiState;
    return Boolean(g.OVT && s && !s.stateLoading && g.overtureRuntime && !g.overtureRuntime.isBootSplashVisible());
  });
}

// Synchronously advance the device by `ticks` main-loop iterations, flushing the
// redraw for whatever input was just injected. This is the deterministic settle:
// `ticks` is in the device's own unit (cf. STEP_HOLD_TICKS, TICK_HZ), so call sites
// read against real constants. Keep the post-gesture default below the hold-promotion
// threshold so a still-held button can't accidentally promote.
export async function advanceTicks(page: Page, ticks = 3): Promise<void> {
  await page.evaluate((n) => (globalThis as OvtGlobal).OVT!.advanceTicks(n), ticks);
}

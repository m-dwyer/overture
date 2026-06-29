import { expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./paths";
import type { CropMode, Target } from "./types";

// Drives the manual-mode banner (via the __OVT_MANUAL_* globals) and paints the
// numbered callouts onto the targeted controls. Styling lives entirely in
// index.css (.manual-target / .manual-target-badge) — this only toggles classes,
// sets the data-manual-index, and writes the badge text. Hard-fails if any
// callout target's aria-label is missing from the DOM (the contract test).
export async function annotate(
  page: Page,
  action: string,
  showing: string,
  targets: Target[] = [],
): Promise<void> {
  const missing = await page.evaluate(
    ({ gesture, show, controls }) => {
      globalThis.__OVT_MANUAL_GESTURE = gesture;
      // JSON legend [{ n, name }] — App renders numbered pills that match the badges.
      globalThis.__OVT_MANUAL_CONTROLS = JSON.stringify(
        controls.map((target, idx) => ({ n: idx + 1, name: target.name })),
      );
      globalThis.__OVT_MANUAL_SHOWING = show;
      for (const badge of document.querySelectorAll(".manual-target-badge"))
        badge.remove();
      for (const el of document.querySelectorAll(".manual-target")) {
        el.classList.remove("manual-target");
        el.removeAttribute("data-manual-index");
      }
      const missingControls: string[] = [];
      for (let i = 0; i < controls.length; i++) {
        const target = controls[i];
        const el = Array.from(
          document.querySelectorAll<HTMLElement>("[aria-label]"),
        ).find((node) => node.getAttribute("aria-label") === target.aria);
        if (!el) {
          missingControls.push(target.aria);
          continue;
        }
        el.classList.add("manual-target");
        el.dataset.manualIndex = String(i + 1);
        const badge = document.createElement("span");
        badge.className = "manual-target-badge";
        badge.textContent = String(i + 1);
        badge.setAttribute("aria-hidden", "true");
        el.appendChild(badge);
      }
      return missingControls;
    },
    { gesture: action, show: showing, controls: targets },
  );
  expect(missing, `manual callout target(s) missing for "${action}"`).toEqual(
    [],
  );
  await page.waitForTimeout(150);
}

// Capture a figure. "panel" grabs the whole annotated Move surface; "oled" grabs
// just the 128×64 screen for a tight close-up.
export async function capture(
  page: Page,
  file: string,
  crop: CropMode = "panel",
): Promise<void> {
  const out = path.join(ASSET_DIR, file);
  const selector = crop === "oled" ? "#oled" : "#manual-capture";
  await page.locator(selector).screenshot({ path: out });
  expect(existsSync(out)).toBe(true);
}

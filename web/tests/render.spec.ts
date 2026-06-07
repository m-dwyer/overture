import { test, expect } from "@playwright/test";

// Smoke + screenshot: the real tool UI should boot and render to the OLED canvas
// without throwing. Captures shot.png (full page) and shot-oled.png (tight crop)
// for visual review, and fails on uncaught page errors.
test("emulator boots the real tool UI and renders", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/");
  // Past the splash; let init() + a few ticks settle.
  await page.waitForTimeout(2500);

  await page.screenshot({ path: "shot.png" });
  await page.locator("#oled").screenshot({ path: "shot-oled.png" });

  await expect(page.locator("#status")).toHaveText("running");

  if (consoleErrors.length) console.log("console errors:\n" + consoleErrors.slice(0, 25).join("\n"));
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

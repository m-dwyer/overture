import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { annotate, capture } from "./manual/annotate";
import { makeDriver } from "./manual/driver";
import { writeGuide } from "./manual/emit-markdown";
import { writeGuideHtml } from "./manual/emit-html";
import { ASSET_DIR, GUIDE_PATH, HTML_PATH, OUT_DIR } from "./manual/paths";
import { scenes } from "./manual/scenarios";
import type { Section, Shot } from "./manual/types";

// Generated beginner-manual figures. This drives the browser emulator's REAL
// ui.js + seq8-wasm engine through the same MIDI entry point as the hardware
// shell, then captures the Move-like panel from ?manual=1.
//
// The work lives in tests/manual/: scenarios.ts (content data), driver.ts (the
// MIDI/emulator engine), annotate.ts (callouts + capture), emit-markdown.ts
// (the writer). This spec is just the orchestrator: boot each scene, run its
// gestures, capture, then write the guide.

test.skip(process.env.MANUAL_GENERATE !== "1", "Run with `pnpm -C web manual:generate`.");

test("generate beginner manual figures and markdown", async ({ page }) => {
  test.setTimeout(120_000);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(ASSET_DIR, { recursive: true });

  const d = makeDriver(page);
  const sections: Section[] = [];

  for (const scene of scenes) {
    await d.boot();
    if (scene.setup) await scene.setup(d);
    const shots: Shot[] = [];
    for (const shot of scene.shots) {
      if (shot.drive) await shot.drive(d);
      await annotate(page, shot.action, shot.showing, shot.targets ?? []);
      await capture(page, shot.file, shot.crop ?? "panel");
      shots.push({ title: shot.title, file: shot.file, caption: shot.caption });
    }
    sections.push({ title: scene.title, body: scene.body, shots });
  }

  writeGuide(sections, scenes);
  writeGuideHtml(sections, scenes);
  expect(existsSync(GUIDE_PATH)).toBe(true);
  expect(existsSync(HTML_PATH)).toBe(true);
});

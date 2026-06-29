import { test } from "@playwright/test";
import { beginnerGuide } from "./manual/content";
import { generateGuide } from "./manual/generate";
import { scenes } from "./manual/scenarios";

// Generated beginner-manual figures. This drives the browser emulator's real
// Overture UI through the same MIDI entry point as the hardware shell, then
// captures the Move-like panel from ?manual=1.
//
// The work lives in tests/manual/: scenarios.ts (content data), driver.ts (the
// real-gesture MIDI engine), annotate.ts (callouts + capture), emit-markdown.ts
// / emit-html.ts (writers), generate.ts (the shared boot→drive→capture→emit
// loop). content.ts holds the beginner framing (intro, cheat-sheet, glossary).

test.skip(
  process.env.MANUAL_GENERATE !== "1",
  "Run with `pnpm -C web manual:generate`.",
);

test("generate beginner manual figures and markdown", async ({ page }) => {
  test.setTimeout(120_000);
  await generateGuide(page, scenes, beginnerGuide);
});

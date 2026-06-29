import { test } from "@playwright/test";
import { generateGuide } from "./manual/generate";
import { referenceGuide } from "./manual/reference-content";
import { scenes } from "./manual/reference";

// Generated full Overture reference manual. Same pipeline as the beginner guide
// (manual-shots.spec.ts) — the real Overture UI driven over MIDI — but a far
// larger scene set covering the whole surface. Output:
// docs/generated/overture-reference.{md,html}, with `ref-` figure filenames in
// the shared assets/ directory.
//
// Content lives in tests/manual/reference.ts (walkthrough) and
// reference-content.ts (intro, cheat-sheet, glossary).

test.skip(
  process.env.REFERENCE_GENERATE !== "1",
  "Run with `pnpm -C web reference:generate`.",
);

test("generate full Overture reference manual", async ({ page }) => {
  test.setTimeout(360_000); // ~21 scenes of boot+drive+capture
  await generateGuide(page, scenes, referenceGuide);
});

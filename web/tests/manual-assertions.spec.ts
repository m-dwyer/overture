import { test } from "@playwright/test";
import { assertScene } from "./manual/generate";
import { scenes as referenceScenes } from "./manual/reference";
import { scenes as beginnerScenes } from "./manual/scenarios";

// Manual-accuracy guard. UNLIKE the generators (manual-shots / manual-reference,
// which are gated behind *_GENERATE=1 and write files), this runs in the normal
// e2e suite (and thus in `mise test`). It drives every documented figure to its
// state via real gestures and asserts the figure's declared `expect` still holds —
// so a behaviour change that would make a screenshot or caption wrong fails the
// suite even if no one regenerates the manuals.
//
// One test PER SCENE: with playwright's fullyParallel + worker pool, the ~23 scenes
// run in parallel (each in its own browser context — clean per-scene isolation),
// instead of one giant serial test per guide. Shots without an `expect` are still
// driven (to set up later shots in the same scene) but not asserted.

const scenes = [
  ...beginnerScenes.map((scene) => ({ guide: "beginner", scene })),
  ...referenceScenes.map((scene) => ({ guide: "reference", scene })),
];

for (const { guide, scene } of scenes) {
  test(`${guide} figure: ${scene.slug}`, async ({ page }) => {
    test.setTimeout(90_000);
    await assertScene(page, scene);
  });
}

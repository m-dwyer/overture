import { test } from "@playwright/test";
import { runAssertions } from "./manual/generate";
import { scenes as referenceScenes } from "./manual/reference";
import { scenes as beginnerScenes } from "./manual/scenarios";

// Manual-accuracy guard. UNLIKE the generators (manual-shots / manual-reference,
// which are gated behind *_GENERATE=1 and write files), this runs in the normal
// e2e suite. It drives every documented figure to its state via real gestures and
// asserts the figure's declared `expect` still holds — so a behaviour change that
// would make a screenshot or its caption wrong fails CI, even if no one regenerates
// the manuals. Shots without an `expect` are still driven (to set up later shots)
// but not asserted.

test("beginner guide figures still depict their captions", async ({ page }) => {
  test.setTimeout(240_000);
  await runAssertions(page, beginnerScenes);
});

test("reference manual figures still depict their captions", async ({ page }) => {
  test.setTimeout(360_000);
  await runAssertions(page, referenceScenes);
});

import { describe, expect, test } from "vitest";
import {
  createBrowserDivider,
  createBrowserItem,
  firstSelectableBrowserIndex,
  isSelectableBrowserItem,
  nextSelectableBrowserIndex,
} from "@overture-ui/components/ui_browser_model.mjs";

describe("Browser model component", () => {
  test("skips divider rows when finding and rotating selectable items", () => {
    const rows = [
      createBrowserDivider("Factory"),
      createBrowserItem("User Pad", { id: "user-pad" }),
      createBrowserDivider("Module"),
      createBrowserItem("Warm Keys", { factoryPreset: true, index: 0 }),
      createBrowserItem("Glass Pad", { factoryPreset: true, index: 1 }),
    ];

    expect(rows[0]).toMatchObject({ kind: "divider", divider: true, name: "Factory" });
    expect(rows[1]).toMatchObject({ kind: "item", name: "User Pad", id: "user-pad" });
    expect(isSelectableBrowserItem(rows[0])).toBe(false);
    expect(isSelectableBrowserItem(rows[1])).toBe(true);
    expect(firstSelectableBrowserIndex(rows)).toBe(1);
    expect(nextSelectableBrowserIndex(rows, 1, 1)).toBe(3);
    expect(nextSelectableBrowserIndex(rows, 3, -1)).toBe(1);
    expect(nextSelectableBrowserIndex(rows, 4, 1)).toBe(4);
  });
});

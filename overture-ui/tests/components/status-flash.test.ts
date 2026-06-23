import { describe, expect, test } from "vitest";
import {
  activeStatusFlashText,
  expireStatusFlash,
  showStatusFlash,
} from "@overture-ui/components/ui_status_flash.mjs";

describe("Status flash component", () => {
  test("shows text until its expiry tick, then clears it", () => {
    const target: any = {};

    expect(showStatusFlash(target, "SAVED", 10, 5)).toBe(true);
    expect(activeStatusFlashText(target, 10)).toBe("SAVED");
    expect(activeStatusFlashText(target, 15)).toBe("SAVED");
    expect(activeStatusFlashText(target, 16)).toBe("");

    expect(expireStatusFlash(target, 15)).toBe(false);
    expect(target.statusFlash).toMatchObject({ text: "SAVED", endTick: 15 });
    expect(expireStatusFlash(target, 16)).toBe(true);
    expect(target.statusFlash).toBe(null);
  });
});

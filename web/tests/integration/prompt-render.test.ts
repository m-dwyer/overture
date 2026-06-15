import { describe, expect, test } from "vitest";
import {
  renderCompressLimitNotice,
  renderMergePlacementPrompt,
  renderNoNoteFlashNotice,
  renderSceneBakePickerPrompt,
} from "@tool-ui/ui_prompt_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
  return {
    clear_screen: () => calls.push(["clear"]),
    print: (x: number, y: number, text: string, color: number) => calls.push(["print", x, y, text, color]),
  };
}

describe("Static prompt presentation", () => {
  test("renders scene-bake picker prompt", () => {
    const calls: DrawCall[] = [];
    renderSceneBakePickerPrompt(createDeps(calls));

    expect(calls).toEqual([
      ["clear"],
      ["print", 4, 8, "BAKE SCENE", 1],
      ["print", 4, 22, "Tap row or scene step", 1],
      ["print", 4, 34, "to pick destination", 1],
      ["print", 4, 50, "Any other btn cancels", 1],
    ]);
  });

  test("renders merge-placement prompt", () => {
    const calls: DrawCall[] = [];
    renderMergePlacementPrompt(createDeps(calls));

    expect(calls).toEqual([
      ["clear"],
      ["print", 4, 8, "PLACE MERGED CLIPS", 1],
      ["print", 4, 22, "Tap row or scene step", 1],
      ["print", 4, 34, "to pick destination", 1],
      ["print", 4, 50, "Capture cancels", 1],
    ]);
  });

  test("renders Track View static notices", () => {
    const compress: DrawCall[] = [];
    renderCompressLimitNotice(createDeps(compress));
    expect(compress).toEqual([
      ["print", 4, 10, "[CLIP       ]", 1],
      ["print", 4, 22, "Beat Stretch", 1],
      ["print", 4, 34, "COMPRESS LIMIT", 1],
    ]);

    const noNote: DrawCall[] = [];
    renderNoNoteFlashNotice(createDeps(noNote));
    expect(noNote).toEqual([
      ["print", 4, 22, "NO NOTE", 1],
      ["print", 4, 34, "Play a pad first", 1],
    ]);
  });
});

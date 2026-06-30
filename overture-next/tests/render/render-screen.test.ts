import { describe, expect, test } from "vitest";
import { renderScreen } from "../../src/render/render-screen";
import type { DisplayPort } from "../../src/ports/outbound";
import type { ScreenView } from "../../src/view";

describe("Overture Next screen rendering", () => {
  test("renders Session View as selected Clip Cell state instead of a step strip", () => {
    const calls: string[] = [];
    const display = createDisplayRecorder(calls);
    const view: ScreenView = {
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 3,
      selectedSceneIndex: 7,
      selectedClipId: null,
      playing: false,
    };

    renderScreen(view, display);

    expect(calls).toContain("print:SESSION");
    expect(calls).toContain("print:Clip Cell");
    expect(calls).toContain("print:Scene 8");
    expect(calls).toContain("print:Empty Cell");
    expect(calls).not.toContain("print:Step 1");
    expect(calls).not.toContain("rect");
  });

  test("renders Track View Sound page chain and synth data", () => {
    const calls: string[] = [];
    const display = createDisplayRecorder(calls);
    const view: ScreenView = {
      kind: "track",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 5,
      playing: false,
      selectedStep: 0,
      trackPage: {
        kind: "sound",
        route: "schwung",
        chainIndex: 1,
        chainName: "Slot2",
        synthModuleId: "westfold",
        synthModuleName: "Westfold",
        synthParameters: ["Gain", "Tone", "Drive", "Attack"],
      },
      steps: [],
    };

    renderScreen(view, display);

    expect(calls).toContain("print:Sound T6");
    expect(calls).toContain("print:Slot2");
    expect(calls).toContain("print:Synth Westfold");
    expect(calls).toContain("print:Params");
    expect(calls).toContain("print:Gain Tone");
    expect(calls).not.toContain("print:OVERTURE NEXT");
    expect(calls).not.toContain("print:STOP");
    expect(calls).not.toContain("print:TRACK");
    expect(calls).not.toContain("print:Step 1");
    expect(calls).not.toContain("rect");
  });
});

function createDisplayRecorder(calls: string[]): DisplayPort {
  return {
    splashSurface: {
      clear() {},
      fillRect() {},
    },
    clear() {
      calls.push("clear");
    },
    print(_x, _y, text) {
      calls.push("print:" + text);
    },
    rect() {
      calls.push("rect");
    },
    flush() {
      calls.push("flush");
    },
  };
}

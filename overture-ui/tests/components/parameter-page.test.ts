import { describe, expect, test } from "vitest";
import {
  parameterPageCells,
  parameterPageCount,
  parameterPageFocusedParam,
  parameterPageIndex,
  renderParameterPage,
} from "@overture-ui/components/ui_parameter_page.mjs";

type DrawCall = [string, ...unknown[]];

function surface(calls: DrawCall[]) {
  return {
    fill_rect: (x: number, y: number, w: number, h: number, color: number) =>
      calls.push(["fill", x, y, w, h, color]),
    print: (x: number, y: number, text: string, color: number) =>
      calls.push(["print", x, y, text, color]),
  };
}

describe("Parameter Page component", () => {
  test("paginates encoder-addressable params into shared grid cells", () => {
    const params = Array.from({ length: 10 }, (_, i) => ({
      label: `Param ${i + 1}`,
      value: String(i + 1),
    }));

    expect(parameterPageCount(params)).toBe(2);
    expect(parameterPageIndex(params, 9)).toBe(1);
    expect(parameterPageCells(params, 1)).toEqual([
      { label: "Param 9", value: "9", highlighted: false },
      { label: "Param 10", value: "10", highlighted: false },
    ]);
  });

  test("builds focused feedback with honest empty and range metadata", () => {
    const params = [{
      label: "Filter Env Depth",
      value: "62",
      rawValue: "62",
      type: "float",
      rangeMin: -100,
      rangeMax: 127,
    }];

    expect(parameterPageFocusedParam(params, 0, 0, "edited")).toMatchObject({
      knob: 1,
      label: "Filter Env Depth",
      displayValue: "62",
      value: "62",
      status: "edited",
      rangeMin: -100,
      rangeMax: 127,
    });
    expect(parameterPageFocusedParam(params, 0, 7)).toMatchObject({
      knob: 8,
      label: "--",
      displayValue: "--",
      status: "empty",
    });
  });

  test("renders grid and focused feedback through the same page contract", () => {
    const gridCalls: DrawCall[] = [];
    renderParameterPage(surface(gridCalls), {
      title: "T1 SYNTH",
      context: "dustline",
      cells: [{ label: "Macro", value: "0.5", highlighted: false }],
      pageIndex: 0,
      pageCount: 1,
      status: "SAVED",
    });

    expect(gridCalls).toContainEqual(["print", 0, 0, "T1 SYNTH", 1]);
    expect(gridCalls).toContainEqual(["print", 54, 1, "[dustline]", 0]);
    expect(gridCalls).toContainEqual(["print", 4, 14, "Mcr", 1]);
    expect(gridCalls).toContainEqual(["print", 4, 22, "0.5", 1]);
    expect(gridCalls).toContainEqual(["print", 0, 54, "SAVED", 1]);

    const focusCalls: DrawCall[] = [];
    renderParameterPage(surface(focusCalls), {
      title: "T1 SYNTH",
      context: "dustline",
      cells: [],
      pageIndex: 0,
      pageCount: 2,
      touchedParam: {
        knob: 3,
        label: "Filter Env Depth",
        value: "62",
        displayValue: "62",
        type: "float",
        rangeMin: -100,
        rangeMax: 127,
        status: "edited",
      },
    });

    expect(focusCalls).toContainEqual(["print", 110, 1, "K3", 0]);
    expect(focusCalls).toContainEqual(["print", 0, 14, "Filter Env Depth", 1]);
    expect(focusCalls).toContainEqual(["print", 58, 38, "62", 0]);
    expect(focusCalls).toContainEqual(["fill", 0, 55, 128, 1, 1]);
  });
});

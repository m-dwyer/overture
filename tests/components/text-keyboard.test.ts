import { describe, expect, test } from "vitest";
import {
  createTextKeyboard,
  normalizeTextKeyboardOptions,
} from "@overture-ui/components/ui_text_keyboard.mjs";

describe("Text keyboard component", () => {
  test("normalizes default text and pad typing defaults", () => {
    expect(normalizeTextKeyboardOptions({ title: "Rename", defaultText: "Preset 1" })).toMatchObject({
      title: "Rename",
      initialText: "Preset 1",
      padSelect: true,
    });

    expect(normalizeTextKeyboardOptions({ initialText: "Custom", defaultText: "Preset 1", padSelect: false })).toMatchObject({
      initialText: "Custom",
      padSelect: false,
    });
  });

  test("renders Overture action labels and returns confirm or cancel results", () => {
    const calls: any[] = [];
    const results: any[] = [];
    const keyboard = createTextKeyboard({
      clear_screen: () => calls.push(["clear"]),
      fill_rect: (...args: any[]) => calls.push(["fill", ...args]),
      print: (...args: any[]) => calls.push(["print", ...args]),
      decodeDelta: (value: number) => value,
      moveMidiInternalSend: (...args: any[]) => calls.push(["midi", ...args]),
      hostPadBlock: (...args: any[]) => calls.push(["padBlock", ...args]),
    });

    expect(keyboard.open({
      title: "Name",
      defaultText: "Preset 123",
      onResult: (result: any) => results.push(result),
    })).toBe(true);

    expect(keyboard.isActive()).toBe(true);
    expect(keyboard.render()).toBe(true);
    expect(calls).toContainEqual(["fill", 0, 0, 22, 10, 1]);
    expect(calls).toContainEqual(["print", 2, 2, "TXT", 0]);
    expect(calls).toContainEqual(["print", 26, 2, "Name: Preset 123", 1]);
    expect(calls).toContainEqual(["print", 43, 53, "Pg", 1]);
    expect(calls).toContainEqual(["print", 63, 53, "Spc", 1]);
    expect(calls).toContainEqual(["print", 87, 53, "Del", 1]);
    expect(calls).toContainEqual(["print", 111, 53, "OK", 1]);

    calls.length = 0;
    expect(keyboard.handleMidi([0x90, 74, 100])).toBe(true);
    expect(keyboard.render()).toBe(true);
    expect(calls).toContainEqual(["print", 26, 2, "Name: Preset 12", 1]);

    expect(keyboard.handleMidi([0x90, 75, 100])).toBe(true);
    expect(results).toEqual([{ action: "confirm", text: "Preset 12" }]);
    expect(keyboard.isActive()).toBe(false);

    expect(keyboard.open({
      title: "Name",
      defaultText: "Preset 1",
      onResult: (result: any) => results.push(result),
    })).toBe(true);
    expect(keyboard.handleMidi([0xb0, 51, 127])).toBe(true);
    expect(results).toEqual([
      { action: "confirm", text: "Preset 12" },
      { action: "cancel", text: null },
    ]);
    expect(keyboard.isActive()).toBe(false);
  });

  test("jog input can edit and confirm without pad typing", () => {
    const results: any[] = [];
    const keyboard = createTextKeyboard({
      clear_screen: () => {},
      fill_rect: () => {},
      print: () => {},
      decodeDelta: (value: number) => value,
    });

    keyboard.open({
      title: "Name",
      defaultText: "",
      padSelect: false,
      onResult: (result: any) => results.push(result),
    });

    expect(keyboard.handleMidi([0xb0, 3, 127])).toBe(true);
    for (let i = 0; i < 29; i++) keyboard.handleMidi([0xb0, 14, 1]);
    expect(keyboard.handleMidi([0xb0, 3, 127])).toBe(true);

    expect(results).toEqual([{ action: "confirm", text: "a" }]);
    expect(keyboard.isActive()).toBe(false);
  });
});

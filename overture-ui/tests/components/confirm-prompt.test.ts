import { describe, expect, test } from "vitest";
import {
  confirmPromptAction,
  createConfirmPrompt,
  renderConfirmPrompt,
  rotateConfirmPrompt,
} from "@overture-ui/components/ui_confirm_prompt.mjs";

describe("Confirm prompt component", () => {
  test("defaults to cancel, toggles with rotate, and renders buttons", () => {
    const prompt = createConfirmPrompt({
      title: "Overwrite?",
      message: "Dust Pad",
      payload: { name: "Dust Pad" },
    });

    expect(confirmPromptAction(prompt)).toBe("cancel");
    expect(rotateConfirmPrompt(prompt, 1)).toBe(true);
    expect(confirmPromptAction(prompt)).toBe("confirm");

    const calls: any[] = [];
    renderConfirmPrompt({
      clear_screen: () => calls.push(["clear"]),
      fill_rect: (...args: any[]) => calls.push(["fill", ...args]),
      print: (...args: any[]) => calls.push(["print", ...args]),
    }, prompt);

    expect(calls).toContainEqual(["print", 34, 3, "Overwrite?", 1]);
    expect(calls).toContainEqual(["print", 40, 24, "Dust Pad", 1]);
    expect(calls).toContainEqual(["print", 27, 50, "No", 1]);
    expect(calls).toContainEqual(["print", 86, 50, "Yes", 0]);
  });
});

import { describe, expect, test } from "vitest";
import { createConfirmPrompt } from "@overture-ui/components/ui_confirm_prompt.mjs";
import { createConfirmPromptContext } from "@overture-ui/context/ui_confirm_prompt_context.mjs";
import { createUiContextStack } from "@overture-ui/context/ui_context_stack.mjs";

describe("UI Context Stack", () => {
  test("top context owns render, jog, and Back until it closes", () => {
    const stack = createUiContextStack();
    const calls: any[] = [];

    stack.push({
      id: "base",
      render: () => {
        calls.push(["render", "base"]);
        return true;
      },
      handleJog: () => {
        calls.push(["jog", "base"]);
        return true;
      },
    });
    stack.push({
      id: "top",
      render: () => {
        calls.push(["render", "top"]);
        return true;
      },
      handleJog: (_event, s) => {
        calls.push(["jog", "top"]);
        s.pop();
        return true;
      },
    });

    expect(stack.size()).toBe(2);
    expect(stack.renderActive({})).toBe(true);
    expect(stack.handleJog({ type: "click" })).toBe(true);
    expect(stack.size()).toBe(1);
    expect(stack.renderActive({})).toBe(true);
    expect(calls).toEqual([
      ["render", "top"],
      ["jog", "top"],
      ["render", "base"],
    ]);
  });

  test("confirm prompt context toggles, confirms, cancels, and renders through the prompt model", () => {
    const stack = createUiContextStack();
    const calls: any[] = [];
    const prompt = createConfirmPrompt({
      title: "Overwrite?",
      message: "Dust Pad",
      payload: { name: "Dust Pad" },
    });

    stack.push(createConfirmPromptContext({
      prompt,
      onConfirm: (p) => calls.push(["confirm", p.payload.name]),
      onCancel: (p) => calls.push(["cancel", p.payload.name]),
      onClose: () => calls.push(["close"]),
      onChange: () => calls.push(["change"]),
    }));

    expect(stack.handleJog({ type: "rotate", delta: 1 })).toBe(true);
    expect(prompt.selected).toBe(1);
    expect(stack.handleJog({ type: "click" })).toBe(true);
    expect(stack.size()).toBe(0);
    expect(calls).toEqual([["change"], ["confirm", "Dust Pad"], ["close"]]);

    calls.length = 0;
    stack.push(createConfirmPromptContext({
      prompt,
      onCancel: (p) => calls.push(["cancel", p.payload.name]),
      onClose: () => calls.push(["close"]),
    }));
    expect(stack.handleBack()).toBe(true);
    expect(calls).toEqual([["cancel", "Dust Pad"], ["close"]]);
  });
});

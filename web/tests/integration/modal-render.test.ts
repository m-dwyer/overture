import { describe, expect, test } from "vitest";
import {
  renderClearAutomationMenu,
  renderInheritPicker,
  renderLgtoConfirm,
  renderRecordBlockedDialog,
  renderSnapshotPicker,
  renderStateWipeConfirm,
} from "@tool-ui/ui_modal_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
  return {
    clear_screen: () => calls.push(["clear"]),
    print: (x: number, y: number, text: string, color: number) => calls.push(["print", x, y, text, color]),
    fill_rect: (x: number, y: number, w: number, h: number, color: number) => calls.push(["fill", x, y, w, h, color]),
    drawMenuHeader: (title: string) => calls.push(["header", title]),
  };
}

describe("Modal presentation", () => {
  test("renders simple confirm dialogs with selected button inversion", () => {
    const stateCalls: DrawCall[] = [];
    renderStateWipeConfirm(createDeps(stateCalls), 0);
    expect(stateCalls).toContainEqual(["header", "Incompatible State"]);
    expect(stateCalls).toContainEqual(["print", 4, 16, "Session incompatible", 1]);
    expect(stateCalls).toContainEqual(["fill", 6, 46, 46, 13, 1]);
    expect(stateCalls).toContainEqual(["print", 20, 49, "Yes", 0]);
    expect(stateCalls).toContainEqual(["print", 91, 49, "No", 1]);

    const recordCalls: DrawCall[] = [];
    renderRecordBlockedDialog(createDeps(recordCalls), 1);
    expect(recordCalls).toContainEqual(["header", "REC Unavailable"]);
    expect(recordCalls).toContainEqual(["print", 4, 16, "Set Dir to Fwd", 1]);
    expect(recordCalls).toContainEqual(["print", 25, 49, "OK", 1]);
    expect(recordCalls).toContainEqual(["fill", 58, 46, 64, 13, 1]);
    expect(recordCalls).toContainEqual(["print", 64, 49, "BAKE NOW", 0]);

    const lgtoCalls: DrawCall[] = [];
    renderLgtoConfirm(createDeps(lgtoCalls), { isDrum: true, selected: 1 });
    expect(lgtoCalls).toContainEqual(["header", "Lgto (lane)"]);
    expect(lgtoCalls).toContainEqual(["print", 4, 16, "Destructive", 1]);
    expect(lgtoCalls).toContainEqual(["print", 25, 49, "OK", 1]);
    expect(lgtoCalls).toContainEqual(["fill", 58, 46, 64, 13, 1]);
    expect(lgtoCalls).toContainEqual(["print", 72, 49, "CANCEL", 0]);
  });

  test("renders inherit picker selected-row inversion and scroll indicators", () => {
    const calls: DrawCall[] = [];
    renderInheritPicker(createDeps(calls), {
      candidates: [
        { uuid: "a", name: "Alpha" },
        { uuid: "b", name: "Beta" },
        { uuid: "c", name: "Gamma" },
        { uuid: "d", name: "Delta" },
      ],
      selectedIndex: 2,
    });

    expect(calls).toContainEqual(["fill", 2, 47, 124, 8, 1]);
    expect(calls).toContainEqual(["print", 5, 48, "Gamma", 0]);
    expect(calls).toContainEqual(["print", 120, 39, "^", 1]);
    expect(calls).toContainEqual(["print", 120, 57, "v", 1]);
  });

  test("renders snapshot picker list with old-state label, inversion, and scroll indicators", () => {
    const calls: DrawCall[] = [];
    renderSnapshotPicker(createDeps(calls), {
      mode: "load",
      snaps: [
        { id: "a", label: "One", sv: 36 },
        { id: "b", label: "Two", sv: 35 },
        { id: "c", label: "Three", sv: 36 },
        { id: "d", label: "Four", sv: 36 },
        { id: "e", label: "Five", sv: 36 },
        { id: "f", label: "Six", sv: 36 },
      ],
      sel: 2,
      confirm: null,
    });

    expect(calls).toContainEqual(["header", "LOAD STATE"]);
    expect(calls).toContainEqual(["print", 5, 20, "Two (old)", 1]);
    expect(calls).toContainEqual(["fill", 2, 28, 124, 8, 1]);
    expect(calls).toContainEqual(["print", 5, 29, "Three", 0]);
    expect(calls).toContainEqual(["print", 120, 20, "^", 1]);
    expect(calls).toContainEqual(["print", 120, 47, "v", 1]);
  });

  test("renders snapshot confirm subviews with selected Yes/No buttons", () => {
    const calls: DrawCall[] = [];
    renderSnapshotPicker(createDeps(calls), {
      mode: "load",
      snaps: [{ id: "target", label: "Gig", sv: 36 }],
      sel: 0,
      confirm: { kind: "load", targetId: "target", sel: 0 },
    });

    expect(calls).toContainEqual(["header", "LOAD STATE"]);
    expect(calls).toContainEqual(["print", 4, 18, "Load Gig", 1]);
    expect(calls).toContainEqual(["fill", 74, 46, 46, 13, 1]);
    expect(calls).toContainEqual(["print", 88, 49, "Yes", 0]);

    const wipeCalls: DrawCall[] = [];
    renderSnapshotPicker(createDeps(wipeCalls), {
      mode: "load",
      snaps: [],
      sel: 0,
      confirm: { kind: "wipe", wipeIds: ["old-a", "old-b"], sel: 1 },
    });
    expect(wipeCalls).toContainEqual(["header", "STATES UPDATED"]);
    expect(wipeCalls).toContainEqual(["print", 4, 18, "Delete 2 snapshot(s)", 1]);
    expect(wipeCalls).toContainEqual(["fill", 6, 46, 46, 13, 1]);
    expect(wipeCalls).toContainEqual(["print", 23, 49, "No", 0]);
  });

  test("renders clear automation checkbox and action rows", () => {
    const calls: DrawCall[] = [];
    renderClearAutomationMenu(createDeps(calls), { sel: 3, at: true, cc: false });

    expect(calls).toContainEqual(["header", "CLEAR AUTOMATION"]);
    expect(calls).toContainEqual(["print", 5, 18, "[x] Aftertouch (AT)", 1]);
    expect(calls).toContainEqual(["print", 5, 27, "( ) Pitch bend (PB)", 1]);
    expect(calls).toContainEqual(["print", 5, 36, "[ ] Control Change (CC)", 1]);
    expect(calls).toContainEqual(["fill", 2, 44, 124, 8, 1]);
    expect(calls).toContainEqual(["print", 5, 45, "CLEAR", 0]);
    expect(calls).toContainEqual(["print", 5, 54, "Cancel", 1]);
  });
});

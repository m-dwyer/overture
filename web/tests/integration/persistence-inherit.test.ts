import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Set-duplicate inheritance: when Move's Copy/Paste makes a duplicate set, the
// inner folder gets a " Copy"/" Copy N" suffix and a fresh UUID with no SEQ8
// state. On the duplicate's first launch, init() reads active_set.txt, sees the
// Copy-suffixed name + missing state file, and looks up family members in
// seq8_name_index.json: 1 candidate → silently inherit (copyStateFiles), 2+ →
// open the inherit picker, 0 → start blank. Driven entirely through the host
// FileStore + re-init (no menu nav). Targets persist/ui_persistence.mjs
// (findInheritCandidates / copyStateFiles / loadNameIndex / stripCopySuffix /
// readActiveSet) + persist/ui_inherit_picker_workflow.mjs.

const ACTIVE_SET = "/data/UserData/schwung/active_set.txt";
const NAME_INDEX = "/data/UserData/schwung/seq8_name_index.json";
const statePath = (u: string) => `/data/UserData/schwung/set_state/${u}/seq8-state.json`;
const uiStatePath = (u: string) => `/data/UserData/schwung/set_state/${u}/seq8-ui-state.json`;
const setsDir = (u: string) => `/data/UserData/UserLibrary/Sets/${u}`;

/** Seed a family member's on-disk state + Set folder so findInheritCandidates'
 * existence checks pass. The name→uuid mapping lives in the name index, written
 * separately by each test. */
function seedMember(h: Harness, uuid: string, state: string): void {
  h.files.write(statePath(uuid), state);
  h.files.write(setsDir(uuid), "set"); // memFiles has no dirs; presence = exists()
}

describe("set-duplicate inheritance on init (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    // S is a module singleton shared across tests; clear inherit-related state so
    // each re-init re-reads the freshly seeded index and starts from no picker.
    const s = h.ui();
    s.nameIndexCache = null;
    s.pendingInheritPicker = null;
  });

  test("single family candidate is silently inherited (auto → copyStateFiles)", () => {
    const SRC = "uuid-src", DST = "uuid-dst";
    const srcState = '{"v":36,"marker":"SRC"}';
    const srcUi = '{"v":9,"at":2}';
    seedMember(h, SRC, srcState);
    h.files.write(uiStatePath(SRC), srcUi);
    h.files.write(NAME_INDEX, JSON.stringify({ "My Song": SRC, "My Song Copy": DST }));
    h.files.write(ACTIVE_SET, DST + "\nMy Song Copy");

    h.resume(0); // assert init-time (synchronous) inherit decision, before deferred tick saves

    // copyStateFiles ran during init → the duplicate now carries the source's state.
    expect(h.files.read(statePath(DST))).toBe(srcState);
    expect(h.files.read(uiStatePath(DST))).toBe(srcUi);
    expect(h.ui().pendingInheritPicker).toBeNull(); // auto, not picker
  });

  test("multiple family candidates open the inherit picker (no auto-copy)", () => {
    const SRC1 = "uuid-base", SRC2 = "uuid-copy2", DST = "uuid-dst2";
    seedMember(h, SRC1, '{"v":36,"marker":"BASE"}');
    seedMember(h, SRC2, '{"v":36,"marker":"COPY2"}');
    h.files.write(NAME_INDEX, JSON.stringify({
      "My Song": SRC1, "My Song Copy 2": SRC2, "My Song Copy": DST,
    }));
    h.files.write(ACTIVE_SET, DST + "\nMy Song Copy");

    h.resume(0);

    const picker = h.ui().pendingInheritPicker as { candidates: Array<{ uuid: string; name: string }>; selectedIndex: number } | null;
    expect(picker, "picker should open for 2+ candidates").not.toBeNull();
    expect(picker!.candidates).toHaveLength(2);
    // Sorted base-name-first.
    expect(picker!.candidates[0].name).toBe("My Song");
    expect(picker!.selectedIndex).toBe(0);
    // Nothing copied yet — that waits on the user's pick.
    expect(h.files.read(statePath(DST))).toBeNull();
  });

  test("no family candidates starts blank (no picker, no copy)", () => {
    const DST = "uuid-orphan";
    h.files.write(NAME_INDEX, JSON.stringify({ "Unrelated": "uuid-x" }));
    h.files.write(ACTIVE_SET, DST + "\nMy Song Copy");

    h.resume(0);

    expect(h.ui().pendingInheritPicker).toBeNull();
    expect(h.files.read(statePath(DST))).toBeNull();
  });

  test("a non-Copy set name never triggers inheritance", () => {
    const DST = "uuid-plain";
    // Family exists, but the active set's name has no Copy suffix → stripCopySuffix
    // returns null → no candidates.
    seedMember(h, "uuid-src3", '{"v":36}');
    h.files.write(NAME_INDEX, JSON.stringify({ "My Song": "uuid-src3", "My Song Plain": DST }));
    h.files.write(ACTIVE_SET, DST + "\nMy Song Plain");

    h.resume(0);

    expect(h.ui().pendingInheritPicker).toBeNull();
    expect(h.files.read(statePath(DST))).toBeNull();
  });
});

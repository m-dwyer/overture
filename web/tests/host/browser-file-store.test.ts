import { describe, expect, test } from "vitest";
import { createBrowserFileStore } from "../../src/host/browser-file-store.js";

const MANIFEST = "/data/UserData/overture/sound_presets/manifest.json";
const BRIGHT =
  "/data/UserData/overture/sound_presets/example-aurora-bright-lead.json";

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe("browser file store", () => {
  test("reads example preset files from the bundled UserData fixture tree", () => {
    const files = createBrowserFileStore(new MemoryStorage());

    const manifest = JSON.parse(files.read(MANIFEST)!);
    expect(manifest.presets).toMatchObject([
      {
        id: "example-aurora-bright-lead",
        scope: "synth/aurora",
        moduleId: "aurora",
      },
      {
        id: "example-aurora-soft-pad",
        scope: "synth/aurora",
        moduleId: "aurora",
      },
      {
        id: "example-aurora-driven-bass",
        scope: "synth/aurora",
        moduleId: "aurora",
      },
    ]);

    const preset = JSON.parse(files.read(BRIGHT)!);
    expect(preset).toMatchObject({
      name: "Bright Lead",
      componentPrefix: "synth",
      componentLabel: "Synth",
      moduleId: "aurora",
      params: { gain: "0.68", tone: "1", output_level: "0.9" },
    });
  });

  test("overlays browser writes on top of fixture files", () => {
    const files = createBrowserFileStore(new MemoryStorage());
    files.write(
      BRIGHT,
      JSON.stringify({ id: "example-aurora-bright-lead", name: "Local Edit" }),
    );

    expect(JSON.parse(files.read(BRIGHT)!).name).toBe("Local Edit");
  });

  test("merges local manifest entries with bundled example presets", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "ovt:" + MANIFEST,
      JSON.stringify({
        v: 1,
        presets: [
          {
            id: "user-aurora",
            name: "My Test",
            ts: 999,
            scope: "synth/aurora",
            componentPrefix: "synth",
            moduleId: "aurora",
            file: "/data/UserData/overture/sound_presets/user-aurora.json",
          },
        ],
      }),
    );
    const files = createBrowserFileStore(storage);

    expect(
      JSON.parse(files.read(MANIFEST)!).presets.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([
      "user-aurora",
      "example-aurora-bright-lead",
      "example-aurora-soft-pad",
      "example-aurora-driven-bass",
    ]);
  });
});

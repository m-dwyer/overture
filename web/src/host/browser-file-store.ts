import type { FileStore } from "./sinks.js";
import manifestJson from "../../fixtures/userdata/overture/sound_presets/manifest.json?raw";
import brightLeadJson from "../../fixtures/userdata/overture/sound_presets/example-aurora-bright-lead.json?raw";
import drivenBassJson from "../../fixtures/userdata/overture/sound_presets/example-aurora-driven-bass.json?raw";
import softPadJson from "../../fixtures/userdata/overture/sound_presets/example-aurora-soft-pad.json?raw";

const STORAGE_PREFIX = "ovt:";
const MANIFEST_PATH = "/data/UserData/overture/sound_presets/manifest.json";

const FIXTURES = new Map<string, string>([
  [MANIFEST_PATH, manifestJson],
  ["/data/UserData/overture/sound_presets/example-aurora-bright-lead.json", brightLeadJson],
  ["/data/UserData/overture/sound_presets/example-aurora-driven-bass.json", drivenBassJson],
  ["/data/UserData/overture/sound_presets/example-aurora-soft-pad.json", softPadJson],
]);

function storageKey(path: string): string {
  return STORAGE_PREFIX + path;
}

function parseManifest(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as { presets?: unknown };
    return Array.isArray(obj.presets) ? obj.presets as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

function mergedManifest(localRaw: string | null, fixtureRaw: string | null): string {
  const presets: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const entry of [...parseManifest(localRaw), ...parseManifest(fixtureRaw)]) {
    const id = String(entry.id || "");
    if (!id || seen.has(id)) continue;
    presets.push(entry);
    seen.add(id);
  }
  return JSON.stringify({ v: 1, presets }, null, 2) + "\n";
}

export function createBrowserFileStore(storage: Storage): FileStore {
  return {
    read(path) {
      const local = storage.getItem(storageKey(path));
      if (path === MANIFEST_PATH) return mergedManifest(local, FIXTURES.get(path) ?? null);
      return local ?? FIXTURES.get(path) ?? null;
    },
    write(path, data) {
      try {
        storage.setItem(storageKey(path), String(data));
        return 1;
      } catch {
        return 0;
      }
    },
    exists(path) {
      return storage.getItem(storageKey(path)) !== null || FIXTURES.has(path);
    },
  };
}

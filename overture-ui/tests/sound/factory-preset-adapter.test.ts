import { afterEach, describe, expect, test } from "vitest";
import {
  listSchwungModuleFactoryPresets,
  loadSchwungModuleFactoryPreset,
} from "@overture-ui/sound/ui_schwung_factory_preset_adapter.mjs";

const components = [
  { label: "MIDI FX", param: "midi_fx1:module", read: "midi_fx1_module", list: "midi_fx" },
  { label: "Synth", param: "synth:module", read: "synth_module", list: "sound_generator" },
  { label: "FX 1", param: "fx1:module", read: "fx1_module", list: "audio_fx" },
  { label: "FX 2", param: "fx2:module", read: "fx2_module", list: "audio_fx" },
];

function soundPage(values: Record<string, string>) {
  return {
    slot: 0,
    selectedIndex: 1,
    modules: [
      null,
      { id: values.synth_module || "aurora", name: values.synth_module || "Aurora" },
      null,
      null,
    ],
  };
}

describe("Schwung factory preset adapter", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "shadow_get_param");
    Reflect.deleteProperty(globalThis, "shadow_set_param");
  });

  test("lists indexed names and falls back to the current preset name or index labels", () => {
    const values: Record<string, string> = {
      synth_module: "aurora",
      "synth:preset_count": "3",
      "synth:preset": "1",
      "synth:preset_name": "Analog Bass",
      "synth:preset_name_0": "Warm Keys",
      "synth:preset_name_2": "Glass Pad",
    };
    Reflect.set(globalThis, "shadow_get_param", (_slot: number, key: string) => values[key] ?? "");

    expect(listSchwungModuleFactoryPresets(components, soundPage(values))).toMatchObject([
      { kind: "item", factoryPreset: true, name: "Warm Keys", index: 0, componentPrefix: "synth", moduleId: "aurora" },
      { kind: "item", factoryPreset: true, name: "Analog Bass", index: 1, componentPrefix: "synth", moduleId: "aurora" },
      { kind: "item", factoryPreset: true, name: "Glass Pad", index: 2, componentPrefix: "synth", moduleId: "aurora" },
    ]);
  });

  test("applies a factory preset through the component preset param", () => {
    const values: Record<string, string> = {
      synth_module: "aurora",
      "synth:preset_name": "Glass Pad",
    };
    const writes: Array<[number, string, string]> = [];
    Reflect.set(globalThis, "shadow_get_param", (_slot: number, key: string) => values[key] ?? "");
    Reflect.set(globalThis, "shadow_set_param", (slot: number, key: string, value: string) => {
      writes.push([slot, key, value]);
      return true;
    });

    const result = loadSchwungModuleFactoryPreset(components, soundPage(values), {
      factoryPreset: true,
      index: 2,
      componentPrefix: "synth",
      moduleId: "aurora",
      name: "Glass Pad",
    });

    expect(result).toMatchObject({ ok: true, preset: { appliedName: "Glass Pad" } });
    expect(writes).toEqual([[0, "synth:preset", "2"]]);
  });
});

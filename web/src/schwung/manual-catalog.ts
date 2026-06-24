import { createBrowserSchwungChain, type BrowserSchwungChain, type BrowserSchwungChainOptions } from "./browser-chain";
import type { RawParam, SchwungCatalog } from "./module-metadata";

type ComponentType = "midi_fx" | "sound_generator" | "audio_fx";

export function makeManualSchwungCatalog(): SchwungCatalog {
  return {
    modules: [
      module("arp", "Arpeggiator", "midi_fx", [
        { key: "rate", name: "Rate", type: "enum", options: ["1/8", "1/16", "1/32"], min: 0, max: 2, default: 1 },
        { key: "gate", name: "Gate", type: "float", min: 0, max: 1, default: 0.65 },
        { key: "octaves", name: "Octaves", type: "int", min: 1, max: 4, default: 1 },
      ]),
      module("chord", "Chord", "midi_fx", [
        { key: "spread", name: "Spread", type: "int", min: 0, max: 12, default: 7 },
        { key: "voices", name: "Voices", type: "int", min: 1, max: 5, default: 3 },
      ]),
      module("linein", "Line In", "sound_generator", []),
      module("aurora", "Aurora", "sound_generator", [
        { key: "gain", name: "Gain", type: "float", min: 0, max: 1, default: 0.5, step: 0.01 },
        { key: "tone", name: "Tone", type: "enum", options: ["Dark", "Bright"], min: 0, max: 1, default: 0 },
        { key: "filter_env_depth", name: "Filter Env Depth", type: "float", rangeMin: -100, rangeMax: 100, default: 20, step: 1 },
        { key: "enabled", name: "Enabled", type: "bool", min: 0, max: 1, default: 1 },
        { key: "drive", name: "Drive", type: "float", min: 0, max: 1, default: 0.25, step: 0.01 },
        { key: "attack", name: "Attack", type: "float", min: 0, max: 1, default: 0.02, step: 0.01 },
        { key: "decay", name: "Decay", type: "float", min: 0, max: 1, default: 0.4, step: 0.01 },
        { key: "release", name: "Release", type: "float", min: 0, max: 1, default: 0.7, step: 0.01 },
        { key: "stereo_width", name: "Stereo Width", type: "float", min: 0, max: 1, default: 0.8, step: 0.01 },
        { key: "output_level", name: "Output Level", type: "float", min: 0, max: 1, default: 0.9, step: 0.01 },
      ], [
        { name: "Warm Keys", params: { gain: 0.52, tone: 1, filter_env_depth: 28 } },
        { name: "Analog Bass", params: { gain: 0.6, drive: 0.34, filter_env_depth: 42 } },
        { name: "Glass Pad", params: { gain: 0.46, stereo_width: 0.95, release: 0.88 } },
      ]),
      module("freeverb", "Freeverb", "audio_fx", [
        { key: "mix", name: "Mix", type: "float", min: 0, max: 1, default: 0.28, step: 0.01 },
        { key: "room_size", name: "Room Size", type: "float", min: 0, max: 1, default: 0.64, step: 0.01 },
        { key: "damping", name: "Damping", type: "float", min: 0, max: 1, default: 0.42, step: 0.01 },
        { key: "width", name: "Width", type: "float", min: 0, max: 1, default: 0.9, step: 0.01 },
        { key: "predelay", name: "Pre-delay", type: "float", min: 0, max: 250, default: 18, step: 1 },
        { key: "low_cut", name: "Low Cut", type: "float", min: 20, max: 1000, default: 180, step: 10 },
        { key: "mod_depth", name: "Mod Depth", type: "float", min: 0, max: 1, default: 0.12, step: 0.01 },
        { key: "freeze", name: "Freeze", type: "bool", min: 0, max: 1, default: 0 },
      ]),
      module("delay", "Delay", "audio_fx", [
        { key: "time", name: "Time", type: "float", min: 0, max: 1, default: 0.35, step: 0.01 },
        { key: "feedback", name: "Feedback", type: "float", min: 0, max: 1, default: 0.45, step: 0.01 },
        { key: "mix", name: "Mix", type: "float", min: 0, max: 1, default: 0.25, step: 0.01 },
      ]),
    ],
  };
}

export async function createManualSchwungChain(
  options: Omit<BrowserSchwungChainOptions, "catalog"> = {}
): Promise<BrowserSchwungChain> {
  const chain = await createBrowserSchwungChain({
    ...options,
    catalog: makeManualSchwungCatalog(),
  });
  chain.shadowSetParam(0, "midi_fx1:module", "arp");
  chain.shadowSetParam(0, "fx1:module", "freeverb");
  return chain;
}

function module(
  id: string,
  name: string,
  componentType: ComponentType,
  params: RawParam[],
  presets: Array<{ name: string; params?: Record<string, number> }> = []
): SchwungCatalog["modules"][number] {
  return {
    componentType,
    id,
    moduleJson: {
      id,
      name,
      component_type: componentType,
      version: "0.0.0-manual",
      capabilities: {
        component_type: componentType,
        ui_hierarchy: {
          levels: {
            root: {
              knobs: params.map((param) => ({ key: String(param.key), name: String(param.name ?? param.key) })),
              params,
            },
          },
        },
      },
    },
    params: params.map((param) => ({ ...param })),
    presets: presets.map((preset) => ({
      ...preset,
      params: preset.params ? { ...preset.params } : undefined,
    })),
  };
}

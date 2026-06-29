import { BrowserSchwungChain } from "../../src/schwung/browser-chain.js";
import type {
  RawParam,
  SchwungCatalog,
} from "../../src/schwung/module-metadata.js";

export async function createDefaultTestSchwungChain(): Promise<BrowserSchwungChain> {
  const chain = new BrowserSchwungChain(makeTestSchwungCatalog(), {
    audioEngine: null,
  });
  chain.shadowSetParam(0, "midi_fx1:module", "arp");
  chain.shadowSetParam(0, "fx1:module", "freeverb");
  // Match normal browser behavior: slots 1-4 keep their default synths. Only
  // clear optional MIDI/audio FX on slots where tests do not need them.
  for (let slot = 1; slot < 4; slot++) {
    chain.shadowSetParam(slot, "midi_fx1:module", "");
    chain.shadowSetParam(slot, "fx1:module", "");
    chain.shadowSetParam(slot, "fx2:module", "");
  }
  return chain;
}

function makeTestSchwungCatalog(): SchwungCatalog {
  return {
    modules: [
      module("arp", "Arpeggiator", "midi_fx", []),
      module("chord", "Chord", "midi_fx", []),
      module("linein", "Line In", "sound_generator", []),
      module(
        "aurora",
        "Aurora",
        "sound_generator",
        [
          {
            key: "gain",
            name: "Gain",
            type: "float",
            min: 0,
            max: 1,
            default: 0.5,
          },
          {
            key: "tone",
            name: "Tone",
            type: "enum",
            options: ["Dark", "Bright"],
            min: 0,
            max: 1,
            default: 0,
          },
          {
            key: "filter_env_depth",
            name: "Filter Env Depth",
            type: "float",
            rangeMin: -100,
            rangeMax: 100,
            default: 20,
          },
          {
            key: "enabled",
            name: "Enabled",
            type: "bool",
            min: 0,
            max: 1,
            default: 1,
          },
          {
            key: "drive",
            name: "Drive",
            type: "float",
            min: 0,
            max: 1,
            default: 0.25,
          },
          {
            key: "attack",
            name: "Attack",
            type: "float",
            min: 0,
            max: 1,
            default: 0.02,
          },
          {
            key: "decay",
            name: "Decay",
            type: "float",
            min: 0,
            max: 1,
            default: 0.4,
          },
          {
            key: "release",
            name: "Release",
            type: "float",
            min: 0,
            max: 1,
            default: 0.7,
          },
          {
            key: "stereo_width",
            name: "Stereo Width",
            type: "float",
            min: 0,
            max: 1,
            default: 0.8,
          },
          {
            key: "output_level",
            name: "Output Level",
            type: "float",
            min: 0,
            max: 1,
            default: 0.9,
          },
        ],
        [
          { name: "Warm Keys", params: { gain: 0.5 } },
          { name: "Analog Bass", params: { gain: 0.5 } },
          { name: "Glass Pad", params: { gain: 0.5 } },
        ],
      ),
      module("freeverb", "Freeverb", "audio_fx", [
        {
          key: "mix",
          name: "Mix",
          type: "float",
          min: 0,
          max: 1,
          default: 0.28,
        },
        {
          key: "room_size",
          name: "Room Size",
          type: "float",
          min: 0,
          max: 1,
          default: 0.64,
        },
        {
          key: "damping",
          name: "Damping",
          type: "float",
          min: 0,
          max: 1,
          default: 0.42,
        },
        {
          key: "width",
          name: "Width",
          type: "float",
          min: 0,
          max: 1,
          default: 0.9,
        },
        {
          key: "predelay",
          name: "Pre-delay",
          type: "float",
          min: 0,
          max: 250,
          default: 18,
        },
        {
          key: "low_cut",
          name: "Low Cut",
          type: "float",
          min: 20,
          max: 1000,
          default: 180,
        },
        {
          key: "mod_depth",
          name: "Mod Depth",
          type: "float",
          min: 0,
          max: 1,
          default: 0.12,
        },
        {
          key: "freeze",
          name: "Freeze",
          type: "bool",
          min: 0,
          max: 1,
          default: 0,
        },
      ]),
      module("delay", "Delay", "audio_fx", []),
    ],
  };
}

function module(
  id: string,
  name: string,
  componentType: "midi_fx" | "sound_generator" | "audio_fx",
  params: RawParam[],
  presets: Array<{ name: string; params?: Record<string, number> }> = [],
): SchwungCatalog["modules"][number] {
  return {
    componentType,
    id,
    moduleJson: {
      id,
      name,
      component_type: componentType,
      version: "0.0.0-test",
      capabilities: {
        component_type: componentType,
        ui_hierarchy: {
          levels: {
            root: {
              knobs: params.map((param) => ({
                key: String(param.key),
                name: String(param.name ?? param.key),
              })),
              params,
            },
          },
        },
      },
    },
    params,
    presets,
  };
}

import { describe, expect, test } from "vitest";
import { BrowserSchwungChain, normalizeHostModuleList } from "../../src/schwung/browser-chain.js";
import type { AudioEngineConfig, ChainAudioEngine, ChainSlotSpec, WorkletMessage } from "../../src/schwung/audio-engine.js";
import type { SchwungCatalog } from "../../src/schwung/module-metadata.js";

class FakeEngine implements ChainAudioEngine {
  active = 0;
  config: AudioEngineConfig | null = null;
  messages: Array<{ message: WorkletMessage; slotId: string }> = [];
  maxActive = 0;
  specs: ChainSlotSpec[] = [];

  async enableChain(slots: ChainSlotSpec[], config: AudioEngineConfig): Promise<void> {
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    await Promise.resolve();
    this.specs = slots;
    this.config = config;
    for (const slot of slots) config.onSlotReady(slot.slotId, slot.kind === "midi_fx" ? "midi_fx" : "audio");
    this.active--;
  }

  hasSlot(slotId: string): boolean {
    return this.specs.some((slot) => slot.slotId === slotId);
  }

  async reloadSlot(): Promise<void> {}

  resetAll(): void {}

  sendToSlot(slotId: string, message: WorkletMessage): void {
    this.messages.push({ message, slotId });
  }

  setMasterVolume(): void {}
}

describe("BrowserSchwungChain", () => {
  test("serves module metadata, params, and presets through host shims", () => {
    const chain = new BrowserSchwungChain(makeCatalog(), { audioEngine: null });

    expect(chain.shadowGetParam(0, "synth_module")).toBe("westfold");
    expect(chain.shadowGetParam(0, "synth:gain")).toBe("0.5");
    expect(chain.shadowGetParam(0, "synth:preset_count")).toBe("2");
    expect(chain.shadowGetParam(0, "synth:preset_name_1")).toBe("Bright");

    expect(chain.shadowSetParam(0, "synth:gain", "0.8")).toBe(true);
    expect(chain.shadowGetParam(0, "synth:gain")).toBe("0.8");

    expect(chain.shadowSetParam(0, "synth:preset", "1")).toBe(true);
    expect(chain.shadowGetParam(0, "synth:preset")).toBe("1");
    expect(chain.shadowGetParam(0, "synth:preset_name")).toBe("Bright");
    expect(chain.shadowGetParam(0, "synth:gain")).toBe("0.9");
  });

  test("normalizes host module list component names", () => {
    const chain = new BrowserSchwungChain(makeCatalog(), { audioEngine: null });
    expect(normalizeHostModuleList(chain.hostListModules())).toEqual([
      { componentType: "midi_fx", id: "arpy", name: "Arpy" },
      { componentType: "sound_generator", id: "westfold", name: "Westfold" },
      { componentType: "audio_fx", id: "trail", name: "Trail" },
      { componentType: "audio_fx", id: "faust_drive", name: "Drive" },
    ]);
  });

  test("routes channel MIDI through MIDI FX, then into the synth, with audio FX behind it", async () => {
    const engine = new FakeEngine();
    const chain = new BrowserSchwungChain(makeCatalog(), { audioEngine: engine });
    expect(chain.shadowSetParam(0, "midi_fx1:module", "arpy")).toBe(true);
    expect(chain.shadowSetParam(0, "fx1:module", "trail")).toBe(true);
    expect(chain.shadowSetParam(0, "fx2:module", "faust_drive")).toBe(true);

    chain.sendMidiToDsp([[0x94, 60, 100]]);
    await flushPromises(20);

    expect(engine.specs.map((slot) => `${slot.slotId}:${slot.kind}:${slot.moduleId}`)).toEqual([
      "slot0:midi_fx1:midi_fx:arpy",
      "slot0:synth:sound_generator:westfold",
      "slot0:fx1:audio_fx:trail",
      "slot0:fx2:audio_fx:faust_drive",
      "slot1:synth:sound_generator:westfold",
      "slot2:synth:sound_generator:westfold",
      "slot3:synth:sound_generator:westfold",
    ]);
    expect(engine.messages.some((item) =>
      item.slotId === "slot0:midi_fx1" && item.message.type === "midiIn" && item.message.status === 0x94
    )).toBe(true);

    engine.config?.onMidiOut({ slotId: "slot0:midi_fx1", status: 0x94, d1: 64, d2: 96 });
    expect(engine.messages.some((item) =>
      item.slotId === "slot0:synth" && item.message.type === "midiIn" && item.message.d1 === 64
    )).toBe(true);
  });

  test("serializes overlapping audio graph sync requests", async () => {
    const engine = new FakeEngine();
    const chain = new BrowserSchwungChain(makeCatalog(), { audioEngine: engine });

    chain.primeAudioEngine();
    chain.shadowSetParam(0, "fx1:module", "trail");
    chain.shadowSetParam(0, "fx2:module", "faust_drive");
    chain.sendMidiToDsp([[0x94, 60, 100]]);
    await flushPromises(20);

    expect(engine.maxActive).toBe(1);
    expect(engine.specs.map((slot) => `${slot.slotId}:${slot.moduleId}`)).toContain("slot0:fx2:faust_drive");
  });
});

async function flushPromises(count: number): Promise<void> {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

function makeCatalog(): SchwungCatalog {
  return {
    modules: [
      {
        componentType: "midi_fx",
        id: "arpy",
        moduleJson: { id: "arpy", name: "Arpy", component_type: "midi_fx", capabilities: { ui_hierarchy: { levels: { root: { params: [] } } } } },
        params: [],
        presets: [],
      },
      {
        componentType: "sound_generator",
        id: "westfold",
        moduleJson: {
          id: "westfold",
          name: "Westfold",
          component_type: "sound_generator",
          capabilities: {
            ui_hierarchy: {
              levels: {
                root: {
                  knobs: [{ key: "gain", name: "Gain" }],
                  params: [{ key: "gain", name: "Gain", min: 0, max: 1, default: 0.5, step: 0.01 }],
                },
              },
            },
          },
        },
        params: [{ key: "gain", name: "Gain", min: 0, max: 1, default: 0.5, step: 0.01 }],
        presets: [
          { name: "Init", params: { gain: 0.5 } },
          { name: "Bright", params: { gain: 0.9 } },
        ],
      },
      {
        componentType: "audio_fx",
        id: "trail",
        moduleJson: { id: "trail", name: "Trail", component_type: "audio_fx", capabilities: { ui_hierarchy: { levels: { root: { params: [] } } } } },
        params: [],
        presets: [],
      },
      {
        componentType: "audio_fx",
        id: "faust_drive",
        moduleJson: { id: "faust_drive", name: "Drive", component_type: "audio_fx", capabilities: { ui_hierarchy: { levels: { root: { params: [] } } } } },
        params: [],
        presets: [],
      },
    ],
  };
}

import {
  AudioWorkletChainEngine,
  type AudioEngineConfig,
  type ChainAudioEngine,
  type ChainSlotSpec,
  type MidiOutEvent,
} from "./audio-engine.js";
import {
  BrowserSchwungDiagnosticsStore,
  type BrowserSchwungDiagnostics,
} from "./diagnostics.js";
import { HostVolumeController } from "./host-volume.js";
import {
  type LoadedSchwungModule,
  type SchwungCatalog,
  type SchwungComponentType,
  loadBrowserSchwungCatalog,
  normalizeComponentType,
} from "./module-metadata.js";

type ComponentKey = "midi_fx1" | "synth" | "fx1" | "fx2";

interface ComponentState {
  moduleId: string;
  params: Record<string, string>;
  presetIndex: number;
  state?: string;
}

interface SlotState {
  channel: number;
  components: Record<ComponentKey, ComponentState>;
  index: number;
  name: string;
}

export type { BrowserSchwungDiagnosticEvent, BrowserSchwungDiagnostics } from "./diagnostics.js";

export interface BrowserSchwungHost {
  diagnostics(): BrowserSchwungDiagnostics;
  handleHostVolumeCc(value: number): boolean;
  hostGetVolume(): number;
  hostSetVolume(volume: number): void;
  hostListModules(): Array<Record<string, unknown>>;
  primeAudioEngine(): void;
  resetAudioEngine(): void;
  routeDspMidi(tag: number, b0: number, b1: number, b2: number, b3: number): void;
  sendMidiToDsp(args: unknown[]): void;
  shadowGetParam(slot: number, key: string): string | null;
  shadowGetSlots(): Array<Record<string, unknown>>;
  shadowSetParam(slot: number, key: string, value: string | number): boolean;
}

export interface BrowserSchwungChainOptions {
  audioEngine?: ChainAudioEngine | null;
  catalog?: SchwungCatalog;
  log?: (message: string) => void;
  notify?: (diagnostics: BrowserSchwungDiagnostics) => void;
  processorName?: string;
  workletUrl?: string;
}

const COMPONENTS: Array<{ key: ComponentKey; kind: SchwungComponentType; moduleParam: string; readParam: string }> = [
  { key: "midi_fx1", kind: "midi_fx", moduleParam: "midi_fx1:module", readParam: "midi_fx1_module" },
  { key: "synth", kind: "sound_generator", moduleParam: "synth:module", readParam: "synth_module" },
  { key: "fx1", kind: "audio_fx", moduleParam: "fx1:module", readParam: "fx1_module" },
  { key: "fx2", kind: "audio_fx", moduleParam: "fx2:module", readParam: "fx2_module" },
];

const DEFAULT_BY_KIND: Record<SchwungComponentType, string[]> = {
  audio_fx: ["freeverb", "trail", "faust_drive"],
  midi_fx: ["arp", "arpy"],
  sound_generator: ["westfold", "aurora", "dustline", "faust_voice"],
};

export async function createBrowserSchwungChain(options: BrowserSchwungChainOptions = {}): Promise<BrowserSchwungChain> {
  const catalog = options.catalog ?? await loadBrowserSchwungCatalog();
  const canUseAudio = typeof window !== "undefined" && "AudioContext" in window && "AudioWorkletNode" in window;
  const audioEngine = options.audioEngine === undefined
    ? (canUseAudio ? new AudioWorkletChainEngine() : null)
    : options.audioEngine;
  return new BrowserSchwungChain(catalog, { ...options, audioEngine });
}

export class BrowserSchwungChain implements BrowserSchwungHost {
  #audioBooted = false;
  #audioEngine: ChainAudioEngine | null;
  #catalog: SchwungCatalog;
  #diagnostics = new BrowserSchwungDiagnosticsStore();
  #hostVolume: HostVolumeController;
  #log: (message: string) => void;
  #modules = new Map<string, LoadedSchwungModule>();
  #notify: (diagnostics: BrowserSchwungDiagnostics) => void;
  #processorName: string;
  #slots: SlotState[];
  #syncInFlight: Promise<void> | null = null;
  #syncQueued = false;
  #workletUrl: string;

  constructor(catalog: SchwungCatalog, options: BrowserSchwungChainOptions = {}) {
    this.#catalog = catalog;
    this.#audioEngine = options.audioEngine ?? null;
    this.#log = options.log ?? (() => {});
    this.#notify = options.notify ?? (() => {});
    this.#hostVolume = new HostVolumeController({
      log: this.#log,
      onChange: () => this.#emit(),
      setMasterGain: (volume) => this.#audioEngine?.setMasterVolume(volume),
    });
    const search = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
    this.#processorName = options.processorName ?? search.get("processor") ?? "module-processor";
    this.#workletUrl = options.workletUrl ?? search.get("worklet") ?? `${import.meta.env.BASE_URL}module-worklet.js`;
    for (const module of catalog.modules) this.#modules.set(module.id, module);
    this.#slots = Array.from({ length: 4 }, (_, index) => this.#makeSlot(index));
    this.#emit();
  }

  diagnostics(): BrowserSchwungDiagnostics {
    return this.#diagnostics.snapshot({
      hostVolume: this.#hostVolume.get(),
      slots: this.#slots.map((slot) => ({
        channel: slot.channel,
        fx1: slot.components.fx1.moduleId,
        fx2: slot.components.fx2.moduleId,
        midiFx: slot.components.midi_fx1.moduleId,
        name: slot.name,
        synth: slot.components.synth.moduleId,
      })),
    });
  }

  handleHostVolumeCc(value: number): boolean {
    return this.#hostVolume.handleRelativeCc(value);
  }

  hostGetVolume(): number {
    return this.#hostVolume.get();
  }

  hostSetVolume(volume: number): void {
    this.#hostVolume.set(volume);
  }

  hostListModules(): Array<Record<string, unknown>> {
    return this.#catalog.modules.map((module) => ({
      api_version: module.moduleJson.api_version,
      capabilities: module.moduleJson.capabilities ?? {},
      component_type: module.componentType,
      id: module.id,
      name: module.moduleJson.name ?? module.id,
      version: module.moduleJson.version ?? "",
    }));
  }

  primeAudioEngine(): void {
    if (this.#audioBooted) {
      void this.#audioEngine?.resume();
      return;
    }
    void this.#syncAudio();
  }

  resetAudioEngine(): void {
    this.#audioEngine?.resetAll();
    this.#log("schwung audio reset");
  }

  routeDspMidi(tag: number, _b0: number, b1: number, b2: number, b3: number): void {
    if (tag !== 0) return;
    const status = b1 & 0xff;
    const type = status & 0xf0;
    if (type === 0xf0) return;
    this.#routeMidi(status, b2 & 0x7f, b3 & 0x7f, "seq");
  }

  sendMidiToDsp(args: unknown[]): void {
    const bytes = Array.isArray(args[0]) ? args[0] as unknown[] : args;
    const status = Number(bytes[0]) & 0xff;
    const d1 = Number(bytes[1]) & 0x7f;
    const d2 = Number(bytes[2]) & 0x7f;
    if (!Number.isFinite(status)) return;
    this.#routeMidi(status, d1, d2, "live");
  }

  shadowGetParam(slotIndex: number, key: string): string | null {
    const slot = this.#slots[slotIndex | 0];
    if (!slot) return null;
    const componentByRead = COMPONENTS.find((component) => key === component.readParam);
    if (componentByRead) return slot.components[componentByRead.key].moduleId;
    const componentByModule = COMPONENTS.find((component) => key === component.moduleParam);
    if (componentByModule) return slot.components[componentByModule.key].moduleId;

    const parsed = parseComponentParamKey(key);
    if (parsed) return this.#getComponentParam(slot, parsed.component, parsed.param);

    const knobMatch = key.match(/^knob_(\d+)_param$/);
    if (knobMatch) return this.#knobName(slot, Number(knobMatch[1]) - 1);
    return null;
  }

  shadowGetSlots(): Array<Record<string, unknown>> {
    return this.#slots.map((slot) => ({ channel: slot.channel, index: slot.index, name: slot.name }));
  }

  shadowSetParam(slotIndex: number, key: string, value: string | number): boolean {
    const slot = this.#slots[slotIndex | 0];
    if (!slot) return false;
    const text = String(value ?? "");
    const moduleComponent = COMPONENTS.find((component) => key === component.moduleParam);
    if (moduleComponent) {
      slot.components[moduleComponent.key] = this.#makeComponent(moduleComponent.kind, text, text === "");
      this.#recordParam(slot.index, key, text);
      void this.#syncAudio();
      return true;
    }

    const parsed = parseComponentParamKey(key);
    if (!parsed) return false;
    const component = slot.components[parsed.component];
    if (parsed.param === "module") {
      const descriptor = COMPONENTS.find((item) => item.key === parsed.component);
      if (!descriptor) return false;
      slot.components[parsed.component] = this.#makeComponent(descriptor.kind, text, text === "");
      this.#recordParam(slot.index, key, text);
      void this.#syncAudio();
      return true;
    }
    if (parsed.param === "preset") {
      this.#applyPreset(slot, parsed.component, Number.parseInt(text, 10));
      this.#recordParam(slot.index, key, text);
      return true;
    }
    if (parsed.param === "state") {
      component.state = text;
      this.#recordParam(slot.index, key, text);
      return true;
    }
    component.params[parsed.param] = text;
    this.#recordParam(slot.index, key, text);
    this.#sendParam(slot, parsed.component, parsed.param, text);
    return true;
  }

  #applyPreset(slot: SlotState, componentKey: ComponentKey, presetIndex: number): void {
    const component = slot.components[componentKey];
    const module = this.#modules.get(component.moduleId);
    const preset = module?.presets[presetIndex];
    if (!preset) return;
    component.presetIndex = presetIndex;
    for (const [key, value] of Object.entries(preset.params ?? {})) {
      component.params[key] = String(value);
      this.#sendParam(slot, componentKey, key, String(value));
    }
  }

  async #syncAudio(): Promise<void> {
    if (this.#syncInFlight) {
      this.#syncQueued = true;
      return this.#syncInFlight;
    }
    this.#syncInFlight = this.#drainAudioSync().finally(() => {
      this.#syncInFlight = null;
    });
    return this.#syncInFlight;
  }

  async #drainAudioSync(): Promise<void> {
    do {
      this.#syncQueued = false;
      await this.#syncAudioOnce();
    } while (this.#syncQueued);
  }

  async #syncAudioOnce(): Promise<void> {
    if (!this.#audioEngine) return;
    const specs = this.#buildSpec();
    if (specs.length === 0) return;
    try {
      await this.#audioEngine.enableChain(specs, this.#audioConfig());
      this.#audioBooted = true;
      this.#audioEngine.setMasterVolume(this.#hostVolume.browserGain());
      for (const slot of this.#slots) this.#seedSlot(slot);
    } catch (error) {
      this.#recordError("chain", String((error as Error).message ?? error));
    }
  }

  #audioConfig(): AudioEngineConfig {
    return {
      onError: (slotId, message) => this.#recordError(slotId, message),
      onMidiOut: (event) => this.#handleMidiFxOut(event),
      onSlotReady: (slotId, mode) => {
        this.#diagnostics.setWorklet(slotId, mode);
        this.#emit();
      },
      processorName: this.#processorName,
      workletUrl: this.#workletUrl,
    };
  }

  #buildSpec(): ChainSlotSpec[] {
    const specs: ChainSlotSpec[] = [];
    for (const slot of this.#slots) {
      if (slot.components.midi_fx1.moduleId) {
        specs.push({ kind: "midi_fx", moduleId: slot.components.midi_fx1.moduleId, slotId: slotId(slot, "midi_fx1") });
      }
      if (slot.components.synth.moduleId) {
        specs.push({ kind: "sound_generator", moduleId: slot.components.synth.moduleId, slotId: slotId(slot, "synth") });
      }
      if (slot.components.fx1.moduleId) {
        specs.push({ kind: "audio_fx", moduleId: slot.components.fx1.moduleId, slotId: slotId(slot, "fx1") });
      }
      if (slot.components.fx2.moduleId) {
        specs.push({ kind: "audio_fx", moduleId: slot.components.fx2.moduleId, slotId: slotId(slot, "fx2") });
      }
    }
    return specs;
  }

  #getComponentParam(slot: SlotState, componentKey: ComponentKey, param: string): string | null {
    const component = slot.components[componentKey];
    const module = this.#modules.get(component.moduleId);
    if (param === "module") return component.moduleId;
    if (param === "ui_hierarchy") return module ? JSON.stringify(module.moduleJson.capabilities?.ui_hierarchy ?? { levels: { root: {} } }) : null;
    if (param === "chain_params") return module ? JSON.stringify(module.params) : null;
    if (param === "preset_count") return String(module?.presets.length ?? 0);
    if (param === "preset") return String(component.presetIndex);
    if (param === "preset_name") return module?.presets[component.presetIndex]?.name ?? "";
    const presetNameMatch = param.match(/^preset_name_(\d+)$/);
    if (presetNameMatch) return module?.presets[Number(presetNameMatch[1])]?.name ?? "";
    if (param === "state") return component.state ?? null;
    if (component.params[param] != null) return component.params[param];
    const paramDef = module?.params.find((item) => item.key === param);
    return paramDef?.default == null ? null : String(paramDef.default);
  }

  #handleMidiFxOut(event: MidiOutEvent): void {
    const parsed = parseSlotId(event.slotId);
    if (!parsed || parsed.component !== "midi_fx1") return;
    const slot = this.#slots[parsed.slot];
    if (!slot) return;
    this.#sendToSynth(slot, event.status, event.d1, event.d2);
  }

  #knobName(slot: SlotState, index: number): string | null {
    const module = this.#modules.get(slot.components.synth.moduleId);
    const knobs = module?.moduleJson.capabilities?.ui_hierarchy?.levels?.root?.knobs ?? module?.params ?? [];
    const knob = knobs[index];
    if (!knob) return null;
    if (typeof knob === "string") return knob;
    return knob.name ?? knob.key ?? null;
  }

  #makeComponent(kind: SchwungComponentType, moduleId: string, allowEmpty = false): ComponentState {
    const fallback = moduleId || (allowEmpty ? "" : this.#firstModuleId(kind));
    const module = this.#modules.get(fallback);
    const params: Record<string, string> = {};
    for (const param of module?.params ?? []) {
      if (param.default != null) params[param.key] = String(param.default);
    }
    return { moduleId: fallback, params, presetIndex: 0 };
  }

  #makeSlot(index: number): SlotState {
    const slot: SlotState = {
      channel: index + 5,
      components: {
        fx1: this.#makeComponent("audio_fx", "", true),
        fx2: this.#makeComponent("audio_fx", "", true),
        midi_fx1: this.#makeComponent("midi_fx", "", true),
        synth: this.#makeComponent("sound_generator", this.#firstModuleId("sound_generator", 0)),
      },
      index,
      name: `Slot${index + 1}`,
    };
    return slot;
  }

  #firstModuleId(kind: SchwungComponentType, preferredIndex = 0): string {
    for (let i = preferredIndex; i < DEFAULT_BY_KIND[kind].length; i++) {
      const preferred = DEFAULT_BY_KIND[kind][i];
      if (preferred && this.#modules.has(preferred)) return preferred;
    }
    return this.#catalog.modules.find((module) => module.componentType === kind)?.id ?? "";
  }

  #recordError(slotId: string, message: string): void {
    this.#diagnostics.recordError(slotId, message);
    this.#log(`schwung ${slotId}: ${message}`);
    this.#emit();
  }

  #recordMidi(slot: number, status: number, d1: number, d2: number, direction: string): void {
    this.#diagnostics.recordMidi(slot, status, d1, d2, direction);
    this.#emit();
  }

  #recordParam(slot: number, key: string, value: string): void {
    this.#diagnostics.recordParam(slot, key, value);
    this.#emit();
  }

  #routeMidi(status: number, d1: number, d2: number, direction: string): void {
    const channel = (status & 0x0f) + 1;
    const slot = this.#slots.find((item) => item.channel === channel) ?? this.#slots[0];
    if (!slot) return;
    this.#recordMidi(slot.index, status, d1, d2, direction);
    if (!this.#audioBooted || this.#syncInFlight) {
      void this.#syncAudio().then(() => {
        if (this.#audioBooted) this.#deliverMidi(slot, status, d1, d2);
      });
      return;
    }
    this.#deliverMidi(slot, status, d1, d2);
  }

  #deliverMidi(slot: SlotState, status: number, d1: number, d2: number): void {
    const midiFxSlotId = slotId(slot, "midi_fx1");
    if (slot.components.midi_fx1.moduleId && this.#audioEngine?.hasSlot(midiFxSlotId)) {
      this.#audioEngine.sendToSlot(midiFxSlotId, { d1, d2, status, type: "midiIn" });
      return;
    }
    this.#sendToSynth(slot, status, d1, d2);
  }

  #seedSlot(slot: SlotState): void {
    (Object.keys(slot.components) as ComponentKey[]).forEach((componentKey) => {
      const component = slot.components[componentKey];
      const id = slotId(slot, componentKey);
      if (!component.moduleId || !this.#audioEngine?.hasSlot(id)) return;
      for (const [key, value] of Object.entries(component.params)) this.#sendParam(slot, componentKey, key, value);
    });
  }

  #sendParam(slot: SlotState, componentKey: ComponentKey, key: string, value: string): void {
    const id = slotId(slot, componentKey);
    if (!this.#audioEngine?.hasSlot(id)) return;
    const module = this.#modules.get(slot.components[componentKey].moduleId);
    const paramIndex = Math.max(0, module?.params.findIndex((param) => param.key === key) ?? 0);
    this.#audioEngine.sendToSlot(id, { id: paramIndex, key, type: "param", value: Number(value) });
  }

  #sendToSynth(slot: SlotState, status: number, d1: number, d2: number): void {
    const synthSlotId = slotId(slot, "synth");
    if (!this.#audioEngine?.hasSlot(synthSlotId)) return;
    this.#audioEngine.sendToSlot(synthSlotId, { d1, d2, status, type: "midiIn" });
  }

  #emit(): void {
    this.#notify(this.diagnostics());
  }
}

function parseComponentParamKey(key: string): { component: ComponentKey; param: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const component = key.slice(0, idx);
  if (component !== "midi_fx1" && component !== "synth" && component !== "fx1" && component !== "fx2") return null;
  return { component, param: key.slice(idx + 1) };
}

function parseSlotId(id: string): { component: ComponentKey; slot: number } | null {
  const match = id.match(/^slot(\d+):(midi_fx1|synth|fx1|fx2)$/);
  if (!match) return null;
  const component = match[2];
  if (component !== "midi_fx1" && component !== "synth" && component !== "fx1" && component !== "fx2") return null;
  return { component, slot: Number(match[1]) };
}

function slotId(slot: SlotState, component: ComponentKey): string {
  return `slot${slot.index}:${component}`;
}

export function normalizeHostModuleList(list: Array<Record<string, unknown>>): Array<{ componentType: SchwungComponentType; id: string; name: string }> {
  return list.map((item) => {
    const componentType = normalizeComponentType(item.component_type ?? item.componentType ?? item.type);
    const id = String(item.id ?? item.module ?? item.name ?? "");
    if (!componentType || !id) return null;
    return { componentType, id, name: String(item.name ?? id) };
  }).filter((item): item is { componentType: SchwungComponentType; id: string; name: string } => item !== null);
}

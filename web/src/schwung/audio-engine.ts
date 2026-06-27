export type SlotKind = "midi_fx" | "sound_generator" | "audio_fx";

export interface ChainSlotSpec {
  kind: SlotKind;
  moduleId: string;
  slotId: string;
}

export interface WorkletMessage {
  type: string;
  [key: string]: unknown;
}

export interface MidiOutEvent {
  d1: number;
  d2: number;
  slotId: string;
  status: number;
}

export const DEFAULT_BROWSER_MASTER_GAIN = 0.55;

export interface AudioEngineConfig {
  onError(slotId: string, message: string): void;
  onMidiOut(event: MidiOutEvent): void;
  onSlotReady(slotId: string, mode: "audio" | "midi_fx"): void;
  processorName: string;
  workletUrl: string;
}

interface SlotEntry {
  kind: SlotKind;
  moduleId: string;
  node: AudioWorkletNode;
  ready: boolean;
  slotId: string;
}

export interface ChainAudioEngine {
  enableChain(slots: ChainSlotSpec[], config: AudioEngineConfig): Promise<void>;
  hasSlot(slotId: string): boolean;
  reloadSlot(slotId: string): Promise<void>;
  resume(): Promise<void>;
  resetAll(): void;
  sendToSlot(slotId: string, message: WorkletMessage): void;
  setMasterVolume(volume: number): void;
}

export class AudioWorkletChainEngine implements ChainAudioEngine {
  #audio: AudioContext | null = null;
  #audioOrder: string[] = [];
  #config: AudioEngineConfig | null = null;
  #contextStart: Promise<void> | null = null;
  #masterGain: GainNode | null = null;
  #processorName: string | null = null;
  #scheduleSink: GainNode | null = null;
  #slots = new Map<string, SlotEntry>();

  async enableChain(slots: ChainSlotSpec[], config: AudioEngineConfig): Promise<void> {
    await this.#ensureContext(config);
    this.#config = config;
    await resumeAudioContext(this.#audio);

    const desired = new Map(slots.map((slot) => [slot.slotId, slot]));
    for (const slotId of Array.from(this.#slots.keys())) {
      if (!desired.has(slotId)) this.#disposeSlot(slotId);
    }

    for (const spec of slots) {
      const existing = this.#slots.get(spec.slotId);
      if (existing && existing.moduleId === spec.moduleId && existing.kind === spec.kind) continue;
      if (existing) this.#disposeSlot(spec.slotId);
      await this.#createSlot(spec);
    }

    this.#rewire(slots);
  }

  hasSlot(slotId: string): boolean {
    return this.#slots.has(slotId);
  }

  async reloadSlot(slotId: string): Promise<void> {
    const slot = this.#slots.get(slotId);
    if (slot) await this.#loadWasmInto(slot);
  }

  resume(): Promise<void> {
    return resumeAudioContext(this.#audio);
  }

  resetAll(): void {
    for (const slot of this.#slots.values()) slot.node.port.postMessage({ type: "reset" });
  }

  sendToSlot(slotId: string, message: WorkletMessage): void {
    this.#slots.get(slotId)?.node.port.postMessage(message);
  }

  setMasterVolume(volume: number): void {
    if (!this.#audio || !this.#masterGain) return;
    const next = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
    this.#masterGain.gain.setTargetAtTime(next, this.#audio.currentTime, 0.01);
  }

  async #ensureContext(config: AudioEngineConfig): Promise<void> {
    if (this.#audio && this.#processorName && this.#masterGain && this.#scheduleSink) return;
    this.#contextStart ??= this.#startContext(config).finally(() => {
      this.#contextStart = null;
    });
    await this.#contextStart;
  }

  async #startContext(config: AudioEngineConfig): Promise<void> {
    const audio = new AudioContext({ sampleRate: 44100 });
    const unlock = resumeAudioContext(audio);
    const loadedWorkletUrl = new URL(config.workletUrl, window.location.href);
    loadedWorkletUrl.searchParams.set("v", String(Date.now()));
    await audio.audioWorklet.addModule(loadedWorkletUrl.toString());
    await unlock;
    this.#audio = audio;
    this.#processorName = config.processorName;
    this.#masterGain = audio.createGain();
    this.#masterGain.gain.value = DEFAULT_BROWSER_MASTER_GAIN;
    this.#masterGain.connect(audio.destination);
    this.#scheduleSink = audio.createGain();
    this.#scheduleSink.gain.value = 0;
    this.#scheduleSink.connect(audio.destination);
  }

  async #createSlot(spec: ChainSlotSpec): Promise<void> {
    if (!this.#audio || !this.#processorName || !this.#config) throw new Error("AudioEngine not initialized");
    const node = new AudioWorkletNode(this.#audio, this.#processorName, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const entry: SlotEntry = { ...spec, node, ready: false };
    const config = this.#config;
    node.port.onmessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data) return;
      if (data.type === "ready") {
        entry.ready = true;
        config.onSlotReady(entry.slotId, data.mode === "midi_fx" ? "midi_fx" : "audio");
      } else if (data.type === "error") {
        config.onError(entry.slotId, String(data.message ?? "Audio failed"));
      } else if (data.type === "midiOut") {
        config.onMidiOut({
          d1: Number(data.d1) & 0x7f,
          d2: Number(data.d2) & 0x7f,
          slotId: entry.slotId,
          status: Number(data.status) & 0xff,
        });
      }
    };
    this.#slots.set(spec.slotId, entry);
    await this.#loadWasmInto(entry);
  }

  async #loadWasmInto(entry: SlotEntry): Promise<void> {
    const wasmPath = `${import.meta.env.BASE_URL}wasm/${entry.moduleId}.wasm`;
    const wasmResponse = await fetch(wasmPath, { cache: "no-store" });
    if (!wasmResponse.ok) {
      const message = `Could not load ${entry.moduleId}.wasm: ${wasmResponse.status}`;
      this.#config?.onError(entry.slotId, message);
      throw new Error(message);
    }
    const wasmBytes = await wasmResponse.arrayBuffer();
    if (!looksLikeWasm(wasmBytes)) {
      const message = `Could not load ${entry.moduleId}: missing WASM build. Build it in Moveforge first.`;
      this.#config?.onError(entry.slotId, message);
      throw new Error(message);
    }
    entry.ready = false;
    entry.node.port.postMessage({ type: "loadWasm", bytes: wasmBytes }, [wasmBytes]);
  }

  #disposeSlot(slotId: string): void {
    const slot = this.#slots.get(slotId);
    if (!slot) return;
    try { slot.node.disconnect(); } catch { /* already disconnected */ }
    slot.node.port.onmessage = null;
    this.#slots.delete(slotId);
    this.#audioOrder = this.#audioOrder.filter((id) => id !== slotId);
  }

  #rewire(slots: ChainSlotSpec[]): void {
    this.#audioOrder = slots
      .filter((slot) => slot.kind === "sound_generator" || slot.kind === "audio_fx")
      .map((slot) => slot.slotId);
    if (!this.#audio || !this.#scheduleSink || !this.#masterGain) return;
    for (const slot of this.#slots.values()) {
      try { slot.node.disconnect(); } catch { /* already disconnected */ }
    }

    const lanes = new Map<number, string[]>();
    for (const slotId of this.#audioOrder) {
      if (!this.#slots.has(slotId)) continue;
      const slotIndex = slotIndexFromId(slotId);
      if (slotIndex == null) continue;
      lanes.set(slotIndex, [...(lanes.get(slotIndex) ?? []), slotId]);
    }

    for (const order of lanes.values()) {
      for (let i = 0; i < order.length - 1; i++) {
        this.#slots.get(order[i])?.node.connect(this.#slots.get(order[i + 1])?.node as AudioNode);
      }
      if (order.length > 0) this.#slots.get(order[order.length - 1])?.node.connect(this.#masterGain);
    }
    for (const slot of this.#slots.values()) {
      if (slot.kind === "midi_fx") slot.node.connect(this.#scheduleSink);
    }
  }
}

function slotIndexFromId(slotId: string): number | null {
  const match = slotId.match(/^slot(\d+):/);
  return match ? Number(match[1]) : null;
}

function looksLikeWasm(bytes: ArrayBuffer): boolean {
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 4));
  return header.length === 4 && header[0] === 0x00 && header[1] === 0x61 && header[2] === 0x73 && header[3] === 0x6d;
}

async function resumeAudioContext(audio: AudioContext | null): Promise<void> {
  if (!audio || audio.state === "closed") return;
  try {
    await audio.resume();
  } catch {
    // Browser autoplay policy can defer unlock until a later gesture; module
    // loading and MIDI routing should still complete so the next gesture can resume.
  }
}

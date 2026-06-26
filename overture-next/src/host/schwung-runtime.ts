type RuntimeGlobal = Record<string, unknown>;
type MidiHandler = (data: readonly number[]) => void;

export interface SchwungRuntimeEntrypoints {
  init(): void;
  tick(): void;
  onMidiMessageInternal: MidiHandler;
  onMidiMessageExternal: MidiHandler;
  onUnload(): void;
}

export function installSchwungRuntime(
  entrypoints: SchwungRuntimeEntrypoints,
  exposed: Record<string, unknown>,
  host: RuntimeGlobal = globalThis,
): void {
  for (const [key, value] of Object.entries(exposed)) {
    host[key] = value;
  }

  host.init = () => {
    entrypoints.init();
  };
  host.tick = () => {
    entrypoints.tick();
  };
  host.onMidiMessageInternal = (data: unknown) => {
    entrypoints.onMidiMessageInternal(asMidiData(data));
  };
  host.onMidiMessageExternal = (data: unknown) => {
    entrypoints.onMidiMessageExternal(asMidiData(data));
  };
  host.onUnload = () => {
    entrypoints.onUnload();
  };
}

function asMidiData(data: unknown): readonly number[] {
  return Array.isArray(data) ? data : [];
}

export type SchwungComponentType = "midi_fx" | "sound_generator" | "audio_fx";

export interface ModuleIndexItem {
  id: string;
  kind?: string;
  name?: string;
  component_type?: string;
}

export interface ModuleIndex {
  modules?: ModuleIndexItem[];
}

export interface RawParam {
  default?: number;
  key: string;
  max?: number;
  min?: number;
  name?: string;
  step?: number;
  type?: string;
  options?: string[];
  [key: string]: unknown;
}

export interface ModuleJson {
  api_version?: number;
  capabilities?: {
    component_type?: string;
    ui_hierarchy?: {
      levels?: {
        root?: {
          knobs?: Array<string | { key?: string; name?: string }>;
          name?: string;
          params?: RawParam[];
        };
      };
    };
  };
  component_type?: string;
  id: string;
  name?: string;
  version?: string;
}

export interface Preset {
  name: string;
  params?: Record<string, number>;
  state?: unknown;
}

export interface PresetsJson {
  presets?: Preset[];
}

export interface LoadedSchwungModule {
  componentType: SchwungComponentType;
  id: string;
  moduleJson: ModuleJson;
  params: RawParam[];
  presets: Preset[];
}

export interface SchwungCatalog {
  modules: LoadedSchwungModule[];
}

export function normalizeComponentType(value: unknown): SchwungComponentType | null {
  const s = String(value ?? "");
  if (s === "midi_fx" || s === "sound_generator" || s === "audio_fx") return s;
  if (s === "synth") return "sound_generator";
  return null;
}

export async function loadBrowserSchwungCatalog(): Promise<SchwungCatalog> {
  const index = await loadJson<ModuleIndex>(`${import.meta.env.BASE_URL}modules/index.json`);
  const items = index.modules ?? [];
  const modules = await Promise.all(items.map((item) => loadModule(item)));
  return { modules: modules.filter((m): m is LoadedSchwungModule => m !== null) };
}

async function loadModule(item: ModuleIndexItem): Promise<LoadedSchwungModule | null> {
  try {
    const [moduleJson, presetsJson] = await Promise.all([
      loadJson<ModuleJson>(`${import.meta.env.BASE_URL}modules/${item.id}/module.json`),
      loadOptionalJson<PresetsJson>(`${import.meta.env.BASE_URL}modules/${item.id}/presets.json`),
    ]);
    const componentType = normalizeComponentType(
      moduleJson.component_type ?? moduleJson.capabilities?.component_type ?? item.component_type ?? item.kind
    );
    if (!componentType) return null;
    return moduleFromJson(moduleJson, presetsJson ?? { presets: [] }, componentType);
  } catch {
    return null;
  }
}

export function moduleFromJson(
  moduleJson: ModuleJson,
  presetsJson: PresetsJson,
  componentType = normalizeComponentType(moduleJson.component_type ?? moduleJson.capabilities?.component_type)
): LoadedSchwungModule | null {
  if (!componentType) return null;
  const params = moduleJson.capabilities?.ui_hierarchy?.levels?.root?.params ?? [];
  return {
    componentType,
    id: moduleJson.id,
    moduleJson,
    params: params.map((param) => ({ ...param })),
    presets: (presetsJson.presets ?? []).map((preset) => ({
      ...preset,
      params: preset.params ? { ...preset.params } : undefined,
    })),
  };
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function loadOptionalJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

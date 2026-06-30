import type {
  SchwungChainReadModel,
  SchwungModuleReadModel,
  SchwungParameterReadModel,
} from "../ports/surface-host-read-model";

export type SchwungHostCall = (name: string, args: unknown[]) => unknown;

/** Reads Schwung chain metadata through the raw host API and returns narrow view-safe read models. */
export class SchwungChainReader {
  constructor(private readonly call: SchwungHostCall) {}

  readChain(chainIndex: number): SchwungChainReadModel | null {
    const normalizedChainIndex = chainIndex | 0;
    const slots = recordArray(this.call("shadow_get_slots", []));
    const slot =
      slots.find((item) => Number(item.index) === normalizedChainIndex) ??
      slots[normalizedChainIndex];
    if (!slot) return null;

    const synthModuleId =
      stringValue(
        this.call("shadow_get_param", [normalizedChainIndex, "synth_module"]),
      ) ??
      stringValue(
        this.call("shadow_get_param", [normalizedChainIndex, "synth:module"]),
      );
    return {
      chainIndex: normalizedChainIndex,
      name:
        stringValue(slot.name) ??
        stringValue(slot.id) ??
        "Chain " + (normalizedChainIndex + 1),
      synthModule: synthModuleId
        ? this.readModule(normalizedChainIndex, synthModuleId)
        : null,
    };
  }

  private readModule(
    chainIndex: number,
    moduleId: string,
  ): SchwungModuleReadModel {
    const modules = recordArray(this.call("host_list_modules", []));
    const module = modules.find((item) => stringValue(item.id) === moduleId);
    return {
      id: moduleId,
      name: stringValue(module?.name) ?? moduleId,
      parameters: this.readSynthParameters(chainIndex),
    };
  }

  private readSynthParameters(chainIndex: number): SchwungParameterReadModel[] {
    const chainParams = parameterRecordArray(
      parseJson(
        this.call("shadow_get_param", [chainIndex, "synth:chain_params"]),
      ),
    );
    const parametersById = new Map<string, SchwungParameterReadModel>();
    for (const parameter of chainParams) {
      const id = stringValue(parameter.key);
      if (!id) continue;
      parametersById.set(id, {
        id,
        name: stringValue(parameter.name) ?? id,
      });
    }

    const rootParameters = readRootParameters(
      parseJson(
        this.call("shadow_get_param", [chainIndex, "synth:ui_hierarchy"]),
      ),
    );
    if (rootParameters.length === 0) return [...parametersById.values()];

    const ordered: SchwungParameterReadModel[] = [];
    for (const parameter of rootParameters) {
      const id = stringValue(parameter.key);
      if (!id) continue;
      const chainParameter = parametersById.get(id);
      ordered.push({
        id,
        name: stringValue(parameter.name) ?? chainParameter?.name ?? id,
      });
    }
    return ordered;
  }
}

function readRootParameters(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value)) return [];
  const levels = value.levels;
  if (!isRecord(levels)) return [];
  const root = levels.root;
  if (!isRecord(root)) return [];
  const knobs = root.knobs;
  if (Array.isArray(knobs) && knobs.length > 0)
    return knobs
      .map((knob) => (typeof knob === "string" ? { key: knob } : knob))
      .filter(isRecord);
  return parameterRecordArray(root.params);
}

function parameterRecordArray(value: unknown): Array<Record<string, unknown>> {
  return recordArray(value).filter((item) => stringValue(item.key));
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

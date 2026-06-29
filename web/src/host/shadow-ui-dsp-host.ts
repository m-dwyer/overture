import type { Dsp } from "../dsp.js";
import type { HostApi } from "../host-api.js";

type DspHostGlobals = Pick<
  HostApi,
  "host_module_get_param" | "host_module_set_param"
>;

export interface DspHostApi {
  api: DspHostGlobals;
  flushSetParams(): void;
}

export function createDspHostApi(dsp: Dsp, strict: boolean): DspHostApi {
  const pendingSetParams = new Map<string, string | number>();

  const applySetParam = (key: string, val: string | number): void => {
    if (key === "bpm") dsp.setBpm(Number(val));
    dsp.set(key, val);
  };

  const flushSetParams = (): void => {
    if (pendingSetParams.size === 0) return;
    for (const [key, val] of pendingSetParams) applySetParam(key, val);
    pendingSetParams.clear();
  };

  return {
    api: {
      host_module_get_param(key: string): string | null {
        return dsp.get(key);
      },
      host_module_set_param(key: string, val: string | number): void {
        if (strict) {
          pendingSetParams.set(key, val);
          return;
        }
        applySetParam(key, val);
      },
    },
    flushSetParams,
  };
}

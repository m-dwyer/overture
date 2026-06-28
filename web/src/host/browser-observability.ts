import type { OvtHarnessHandle } from "./emulator-harness";

export interface ManualAnnotation {
  controls: string;
  gesture: string;
  showing: string;
}

export interface BrowserObservabilityPort {
  clear(): void;
  publish(handle: OvtHarnessHandle): void;
  publishOledText(text: string): void;
  readManualAnnotation(): ManualAnnotation;
}

export function createGlobalBrowserObservability(target: typeof globalThis = globalThis): BrowserObservabilityPort {
  return {
    clear() {
      target.OVT = undefined;
    },
    publish(handle) {
      target.OVT = handle;
    },
    publishOledText(text) {
      target.__OVT_OLED_TEXT = text;
    },
    readManualAnnotation() {
      return {
        controls: target.__OVT_MANUAL_CONTROLS ?? "",
        gesture: target.__OVT_MANUAL_GESTURE ?? "",
        showing: target.__OVT_MANUAL_SHOWING ?? "",
      };
    },
  };
}

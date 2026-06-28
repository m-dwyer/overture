import { describe, expect, test } from "vitest";
import { createGlobalBrowserObservability } from "../../src/host/browser-observability";

describe("browser observability", () => {
  test("publishes harness, OLED text, and manual annotation through one global adapter", () => {
    const target = {
      __OVT_MANUAL_CONTROLS: "[{\"n\":1,\"name\":\"Play\"}]",
      __OVT_MANUAL_GESTURE: "Press Play",
      __OVT_MANUAL_SHOWING: "Transport",
    } as typeof globalThis;
    const observability = createGlobalBrowserObservability(target);
    const handle = { advanceTicks() {}, midiExt() {}, midiIn() {} };

    observability.publish(handle as never);
    observability.publishOledText("TRACK 1");

    expect(target.OVT).toBe(handle);
    expect(target.__OVT_OLED_TEXT).toBe("TRACK 1");
    expect(observability.readManualAnnotation()).toEqual({
      controls: "[{\"n\":1,\"name\":\"Play\"}]",
      gesture: "Press Play",
      showing: "Transport",
    });

    observability.clear();
    expect(target.OVT).toBeUndefined();
  });
});

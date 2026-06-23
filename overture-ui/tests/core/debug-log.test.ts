import { describe, test, expect, beforeEach } from "vitest";
import {
  initDebugLog,
  dlog,
  _debugLogRingForTest,
  _resetDebugLogForTest,
} from "@overture-ui/core/ui_debug_log.mjs";

// The call sites are gated `OVERTURE_DEBUG_LOG && dlog(...)`; vitest defines
// OVERTURE_DEBUG_LOG=true so this exercises the real logger. host_write_file is
// absent off-device, so nothing is written — we assert on the in-memory ring.
describe("dev debug logger (ui_debug_log)", () => {
  beforeEach(() => {
    _resetDebugLogForTest("OFF");
    Reflect.deleteProperty(globalThis, "host_read_file");
    Reflect.deleteProperty(globalThis, "host_write_file");
  });

  test("default OFF writes nothing — even ERROR is dropped", () => {
    dlog("ERROR", "boom");
    dlog("DEBUG", "noise");
    expect(_debugLogRingForTest()).toEqual([]);
  });

  test("threshold gates by level: WARN keeps ERROR/WARN, drops INFO/DEBUG", () => {
    _resetDebugLogForTest("WARN");
    dlog("ERROR", "e");
    dlog("WARN", "w");
    dlog("INFO", "i");
    dlog("DEBUG", "d");
    const ring = _debugLogRingForTest();
    expect(ring.map((l) => l.split(" ")[1])).toEqual(["ERROR", "WARN"]);
  });

  test("DEBUG level keeps everything, in order, with a monotonic seq", () => {
    _resetDebugLogForTest("DEBUG");
    dlog("INFO", "first");
    dlog("DEBUG", "second");
    const ring = _debugLogRingForTest();
    expect(ring).toEqual(["1 INFO first", "2 DEBUG second"]);
  });

  test("ring is bounded — never grows past RING_MAX (400) lines", () => {
    _resetDebugLogForTest("DEBUG");
    for (let i = 0; i < 1000; i++) dlog("DEBUG", "line" + i);
    const ring = _debugLogRingForTest();
    expect(ring.length).toBe(400);
    // keeps the most recent lines
    expect(ring[ring.length - 1]).toBe("1000 DEBUG line999");
    expect(ring[0]).toBe("601 DEBUG line600");
  });

  test("unknown level name is treated as INFO", () => {
    _resetDebugLogForTest("DEBUG");
    dlog("WHATEVER" as unknown as string, "x");
    expect(_debugLogRingForTest()).toEqual(["1 WHATEVER x"]);
  });

  test("uses Overture home for level and log files", () => {
    const writes: Array<[string, string]> = [];
    Reflect.set(globalThis, "host_read_file", (path: string) =>
      path === "/data/UserData/overture/overture-debug-level" ? "DEBUG" : null
    );
    Reflect.set(globalThis, "host_write_file", (path: string, body: string) => {
      writes.push([path, body]);
      return true;
    });

    initDebugLog();
    dlog("DEBUG", "sound-edit trace");

    expect(writes.map(([path]) => path)).toEqual([
      "/data/UserData/overture/overture-debug.log",
      "/data/UserData/overture/overture-debug.log",
    ]);
    expect(writes.at(-1)?.[1]).toContain("sound-edit trace");
  });
});

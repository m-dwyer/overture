import { OvertureCoreRuntime } from "./core-runtime";
import type { OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  return OvertureCoreRuntime.createDefault();
}

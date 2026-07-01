import { createInitialControlSurfaceContext } from "../state/control-surface-context";
import { createDefaultProject } from "../state/project";
import { ControlInputInterpreter } from "./controls/control-input-interpreter";
import { OvertureCoreRuntime } from "./core-runtime";
import { DomainIntentRouter } from "./intents/domain-intent-router";
import { createPlayback } from "./playback";
import { createTransport } from "./transport";
import type { OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const control = createInitialControlSurfaceContext();
  const transport = createTransport();
  const playback = createPlayback();
  const controlInputInterpreter = new ControlInputInterpreter();
  const domainIntentRouter = new DomainIntentRouter({
    control,
    project,
    playback,
    transport,
  });

  playback.seedDefaultScene(project);

  return new OvertureCoreRuntime(
    project,
    control,
    transport,
    playback,
    controlInputInterpreter,
    domainIntentRouter,
  );
}

import { createInitialControlSurfaceContext } from "../state/control-surface-context";
import { createDefaultProject } from "../state/project";
import { createPlayback, type Playback } from "./playback";
import { createTransport, type Transport } from "./transport";

export interface CoreOwners {
  readonly control: ReturnType<typeof createInitialControlSurfaceContext>;
  readonly project: ReturnType<typeof createDefaultProject>;
  readonly playback: Playback;
  readonly transport: Transport;
}

export function createCoreOwners(): CoreOwners {
  const project = createDefaultProject();
  const control = createInitialControlSurfaceContext();
  const transport = createTransport();
  const playback = createPlayback();

  playback.seedDefaultScene(project);

  return {
    control,
    project,
    playback,
    transport,
  };
}

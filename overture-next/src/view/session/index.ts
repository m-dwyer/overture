import type { CoreSnapshot } from "../../application/types";
import type { SurfaceHostReadModel } from "../../ports/surface-host-read-model";
import type { PadLedView, ScreenView, SurfaceHint } from "../types";
import { createSessionPadLeds } from "./internal/pad-leds";
import { createSessionScreenView } from "./internal/screen-view";

export const sessionView = {
  createScreenView(
    snapshot: CoreSnapshot,
    _hostReadModel?: SurfaceHostReadModel,
  ): ScreenView {
    return createSessionScreenView(snapshot);
  },
  createPadLeds(
    snapshot: CoreSnapshot,
    surfaceHints: readonly SurfaceHint[],
  ): PadLedView[] {
    return createSessionPadLeds(snapshot, surfaceHints);
  },
};

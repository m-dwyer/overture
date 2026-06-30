import type { CoreSnapshot } from "../../application/types";
import type { SurfaceHostReadModel } from "../../ports/surface-host-read-model";
import { SESSION_PAD_COUNT } from "../../shared/session-grid";
import type { PadLedView, ScreenView, SurfaceHint } from "../types";
import { createTrackScreenView } from "./internal/screen-view";
import { createTrackSurfaceHints } from "./internal/surface-hints";

export const trackView = {
  createScreenView(
    snapshot: CoreSnapshot,
    hostReadModel?: SurfaceHostReadModel,
  ): ScreenView {
    return createTrackScreenView(snapshot, hostReadModel);
  },
  createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
    return createTrackSurfaceHints(snapshot);
  },
  createPadLeds(
    _snapshot: CoreSnapshot,
    _surfaceHints: readonly SurfaceHint[],
  ): PadLedView[] {
    return Array.from({ length: SESSION_PAD_COUNT }, (_, padIndex) => ({
      padIndex,
      state: "off" as const,
    }));
  },
};

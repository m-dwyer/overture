import type { CoreSnapshot } from "../../core/types";
import { SESSION_PAD_COUNT } from "../../session-grid";
import type { PadLedView, ScreenView, SurfaceHint } from "../types";
import { createTrackScreenView } from "./internal/screen-view";
import { createTrackSurfaceHints } from "./internal/surface-hints";

export const trackView = {
  createScreenView(snapshot: CoreSnapshot): ScreenView {
    return createTrackScreenView(snapshot);
  },
  createSurfaceHints(_snapshot: CoreSnapshot): SurfaceHint[] {
    return createTrackSurfaceHints();
  },
  createPadLeds(_snapshot: CoreSnapshot, _surfaceHints: readonly SurfaceHint[]): PadLedView[] {
    return Array.from({ length: SESSION_PAD_COUNT }, (_, padIndex) => ({ padIndex, state: "off" as const }));
  },
};

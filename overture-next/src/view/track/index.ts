import type { CoreSnapshot } from "../../core/types";
import type { ScreenView, SurfaceHint } from "../types";
import { createTrackScreenView } from "./internal/screen-view";
import { createTrackSurfaceHints } from "./internal/surface-hints";

export const trackView = {
  createScreenView(snapshot: CoreSnapshot): ScreenView {
    return createTrackScreenView(snapshot);
  },
  createSurfaceHints(_snapshot: CoreSnapshot): SurfaceHint[] {
    return createTrackSurfaceHints();
  },
};

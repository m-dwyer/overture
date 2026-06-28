import type { CoreSnapshot } from "../../application/types";
import type { PadLedView, ScreenView, SurfaceHint } from "../types";
import { createSessionPadLeds } from "./internal/pad-leds";
import { createSessionScreenView } from "./internal/screen-view";
import { createSessionSurfaceHints } from "./internal/surface-hints";

export const sessionView = {
  createScreenView(snapshot: CoreSnapshot): ScreenView {
    return createSessionScreenView(snapshot);
  },
  createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
    return createSessionSurfaceHints(snapshot);
  },
  createPadLeds(snapshot: CoreSnapshot, surfaceHints: readonly SurfaceHint[]): PadLedView[] {
    return createSessionPadLeds(snapshot, surfaceHints);
  },
};

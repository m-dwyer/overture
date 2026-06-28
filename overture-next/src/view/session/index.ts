import type { CoreSnapshot } from "../../core/types";
import type { ScreenView, SurfaceHint } from "../types";
import { createSessionScreenView } from "./internal/screen-view";
import { createSessionSurfaceHints } from "./internal/surface-hints";

export const sessionView = {
  createScreenView(snapshot: CoreSnapshot): ScreenView {
    return createSessionScreenView(snapshot);
  },
  createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
    return createSessionSurfaceHints(snapshot);
  },
};

import type { CoreSnapshot } from "../../application/types";
import { sessionView } from "../session";
import { trackView } from "../track";
import type { PadLedView, ScreenView, SurfaceHint } from "../types";

interface ViewModule {
  createScreenView(snapshot: CoreSnapshot): ScreenView;
  createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[];
  createPadLeds(snapshot: CoreSnapshot, surfaceHints: readonly SurfaceHint[]): PadLedView[];
}

export function viewModuleFor(snapshot: CoreSnapshot): ViewModule {
  return snapshot.activeView === "session" ? sessionView : trackView;
}

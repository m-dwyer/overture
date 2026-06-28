import type { CoreSnapshot } from "../../core/types";
import { sessionView } from "../session";
import { trackView } from "../track";
import type { ScreenView, SurfaceHint } from "../types";

interface ViewModule {
  createScreenView(snapshot: CoreSnapshot): ScreenView;
  createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[];
}

export function viewModuleFor(snapshot: CoreSnapshot): ViewModule {
  return snapshot.activeView === "session" ? sessionView : trackView;
}

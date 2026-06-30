import type { CoreSnapshot } from "../../application/types";
import type { SurfaceHostReadModel } from "../../ports/surface-host-read-model";
import {
  TRACK_PAD_COUNT,
  noteForTrackPad,
} from "../../shared/track-pad-layout";
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
    snapshot: CoreSnapshot,
    _surfaceHints: readonly SurfaceHint[],
  ): PadLedView[] {
    return Array.from({ length: TRACK_PAD_COUNT }, (_, padIndex) => {
      const note = noteForTrackPad(padIndex);
      const pressed = snapshot.heldPads?.some(
        (heldPad) => heldPad.padIndex === padIndex,
      );
      const sounding = snapshot.activeNotes?.some(
        (active) =>
          active.trackIndex === snapshot.selectedTrackIndex &&
          active.note === note,
      );
      const state: PadLedView["state"] = pressed
        ? "pressed"
        : sounding
          ? "playing"
          : "playable";
      return { padIndex, state };
    });
  },
};

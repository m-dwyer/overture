export {
  CC,
  JOG_TOUCH,
  KNOB_CC0,
  KNOB_TOUCH0,
  MASTER_TOUCH,
  NAV,
  NOTE_OFF,
  NOTE_ON,
  PAD_COUNT,
  PAD_NOTE0,
  PAD_VELOCITY,
  ROW_CC,
  STEP_CC0,
  VOLUME_CC,
  type Send,
} from "../../../overture-next/src/host/move-controls";

/** Track-strip colours, top→bottom (Track 1..4): blue / magenta / orange / green. */
export const TRACK_COLORS = ["#2840e0", "#ff20c0", "#c85a10", "#30ff50"] as const;

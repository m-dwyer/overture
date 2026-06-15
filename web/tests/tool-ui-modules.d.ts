declare module "@tool-ui/ui_state.mjs" {
  export const S: any;
}

declare module "@tool-ui/ui_routes.mjs" {
  export function describeEditSoundForTrack(track: number, caps: { hasCoRun: boolean; hasMoveInject: boolean }): unknown;
  export function matchingSchwungSlotMask(trackChannel: number, slots: Array<{ channel?: number; name?: string }>): number;
  export function routeScopeShortLabel(track: number): string;
}

declare module "@tool-ui/ui_route_check.mjs" {
  export function routeCheckStatus(track: number, slots: Array<Record<string, unknown>> | null): string;
  export function routeCheckViewModel(selected: number, slots: Array<Record<string, unknown>> | null): unknown;
}

declare module "@tool-ui/ui_sound_edit.mjs" {
  export function advancePendingEditSoundEntry(activeTrack: number): unknown;
  export function requestEditSoundForTrack(track: number, caps: { hasCoRun: boolean; hasMoveInject: boolean }): { title: string; body: string };
}

declare module "@tool-ui/ui_motion.mjs" {
  export const PARAM_PEEK_DETAIL_TICKS: number;
  export function autoLaneLabel(track: number, lane: number, includeLane: boolean): string;
  export function motionIdleModel(track: number, clip: number): any;
  export function motionOverviewModel(track: number, clip: number): any;
  export function paramPeekInfo(): unknown;
}

declare module "@tool-ui/ui_bank_render.mjs" {
  export function renderAllLanesBankOverview(deps: any): void;
  export function renderAllLanesConfirm(deps: any): void;
  export function renderDrumLaneBankOverview(deps: any): void;
  export function renderDrumMidiDelayBankOverview(deps: any): void;
  export function renderDrumNoteFxBankOverview(deps: any): void;
  export function renderDrumRepeatGrooveBankOverview(deps: any): void;
  export function renderGenericBankOverview(deps: any, bank: number): void;
  export function renderMelodicNoteFxBankOverview(deps: any): void;
  export function renderMotionBankOverview(deps: any): void;
}

declare module "@tool-ui/ui_idle_render.mjs" {
  export function renderSessionIdleView(deps: any): void;
  export function renderDrumTrackIdleView(deps: any): void;
  export function renderMelodicTrackIdleView(deps: any): void;
}

declare module "@tool-ui/ui_popup_render.mjs" {
  export function renderSessionActionPopup(deps: any): void;
  export function renderTrackActionPopup(deps: any): void;
}

declare module "@tool-ui/ui_tick_tasks.mjs" {
  export function runDefaultSetParamDrain(S: any, deps: any): void;
  export function runMoveCoRunTickTasks(S: any, deps: any): void;
  export function runDeferredContentResyncTasks(S: any, deps: any): void;
  export function runEndOfTickPersistenceTasks(S: any, deps: any): void;
}

declare module "@tool-ui/ui_clip_track_sync.mjs" {
  export function readMelodicClipFromDsp(S: any, deps: any, track: number, clip: number, opts: any): void;
  export function readDrumActiveLaneFromDsp(S: any, deps: any, track: number): void;
  export function readTrackConfigFromDsp(S: any, deps: any, track: number): void;
  export function refreshDrumLaneBankParamsFromDsp(S: any, deps: any, track: number, lane: number): void;
  export function refreshPerClipBankParamsFromDsp(S: any, deps: any, track: number): void;
  export function readTargetedClipAutomationFromDsp(S: any, deps: any, track: number, clip: number): void;
  export function readTargetedClipRestorePairFromDsp(S: any, deps: any, track: number, clip: number, isDrum: boolean): void;
}

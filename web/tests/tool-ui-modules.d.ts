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

declare module "@tool-ui/ui_tick_tasks.mjs" {
  export function runDefaultSetParamDrain(S: any, deps: any): void;
  export function runMoveCoRunTickTasks(S: any, deps: any): void;
  export function runDeferredContentResyncTasks(S: any, deps: any): void;
  export function runEndOfTickPersistenceTasks(S: any, deps: any): void;
}

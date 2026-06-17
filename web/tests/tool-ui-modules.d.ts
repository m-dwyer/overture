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

declare module "@tool-ui/ui_prompt_render.mjs" {
  export function renderCompressLimitNotice(deps: any): void;
  export function renderMergePlacementPrompt(deps: any): void;
  export function renderNoNoteFlashNotice(deps: any): void;
  export function renderSceneBakePickerPrompt(deps: any): void;
  export function renderShiftStepHelp(deps: any): void;
}

declare module "@tool-ui/ui_param_peek_render.mjs" {
  export function renderParamPeek(deps: any): void;
}

declare module "@tool-ui/ui_loop_render.mjs" {
  export function renderLoopView(deps: any): void;
}

declare module "@tool-ui/ui_step_interval_render.mjs" {
  export function renderStepIntervalOverlay(deps: any, bank: number): void;
}

declare module "@tool-ui/ui_tick_tasks.mjs" {
  export function runDefaultSetParamDrain(S: any, deps: any): void;
  export function runMoveCoRunTickTasks(S: any, deps: any): void;
  export function runDeferredContentResyncTasks(S: any, deps: any): void;
  export function runEndOfTickPersistenceTasks(S: any, deps: any): void;
}

declare module "@tool-ui/ui_sync_adapters.mjs" {
  type HostFn = (...args: unknown[]) => unknown;
  export function optionalHostModuleGetParam(): HostFn | null;
  export function optionalHostModuleGetParamUndefined(): HostFn | undefined;
  export function optionalHostModuleSetParam(): HostFn | null;
  export function optionalHostReadFile(): HostFn | null;
  export function optionalHostWriteFile(): HostFn | null;
  export function optionalHostFileExists(): HostFn | null;
  export function hasShadowSetParam(): boolean;
  export function createHostParamAdapters(): { getParam: HostFn | null; setParam: HostFn | null };
  export function createUiFlagAdapters(): { clearFlags: HostFn | null; getFlagsFn: () => unknown; setFlagsFn: (fn: unknown) => void };
}

declare module "@tool-ui/ui_input_adapters.mjs" {
  type HostFn = (...args: unknown[]) => unknown;
  export function optionalMoveMidiInjectToMove(): HostFn | null;
  export function optionalMoveMidiExternalSend(): HostFn | null;
  export function optionalShadowSendMidiToDsp(): HostFn | null;
  export function optionalHostExitModule(): HostFn | null;
  export function createExtMidiRemapHostAdapters(): { clear: HostFn | null; set: HostFn | null; enable: HostFn | null };
  export function createButtonCcHardwareAdapters(): Record<string, number>;
  export function createInputDispatchHardwareAdapters(): Record<string, number>;
  export function createJogCcHardwareAdapters(): Record<string, number>;
  export function createMidiInternalHardwareAdapters(): Record<string, number>;
  export function createNavigationCcHardwareAdapters(): Record<string, number>;
  export function createPadHardwareAdapters(): Record<string, number>;
  export function createTransportCcHardwareAdapters(): Record<string, number>;
}

declare module "@tool-ui/ui_tick_adapters.mjs" {
  type HostFn = (...args: unknown[]) => unknown;
  export function createTickHostAdapters(): Record<string, HostFn | null>;
}

declare module "@tool-ui/ui_entrypoint_diagnostics.mjs" {
  export const ENTRYPOINT_ERROR_LOG_PATH: string;
  export function createEntrypointErrorWrapper(S: any): {
    captureError(where: string, e: unknown): void;
    runEntrypoint<T>(where: string, fn: () => T): T | undefined;
  };
}

declare module "@tool-ui/ui_input_dispatch_workflow.mjs" {
  export function onCcButtonsImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onCcJogImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onCcKnobsImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onCcMsgImpl(deps: any, d1: number, d2: number): void;
  export function onCcSideImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onCcStepEditImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onCcTransportImpl(S: any, deps: any, d1: number, d2: number): void;
  export function onPadPressImpl(S: any, deps: any, status: number, d1: number, d2: number): void;
  export function onPadPressTrackViewImpl(S: any, deps: any, status: number, d1: number, d2: number): void;
  export function onPadReleaseImpl(S: any, deps: any, status: number, d1: number, d2: number): void;
  export function onStepButtonsImpl(S: any, deps: any, d1: number, d2: number): void;
  export function switchViewCleanupImpl(S: any, deps: any): void;
}

declare module "@tool-ui/ui_init_workflow.mjs" {
  export function runInitWorkflowImpl(S: any, deps: any): void;
}

declare module "@tool-ui/ui_live_note_workflow.mjs" {
  export function createLiveNoteRecordingState(): { recordingNoteTrack: Map<number, number>; extHeldNotes: Map<number, any> };
  export function recordNoteOnImpl(S: any, state: any, pitch: number, velocity: number, rt: number): void;
  export function recordNoteOffImpl(S: any, state: any, pitch: number): void;
  export function liveSendNoteImpl(S: any, deps: any, t: number, type: number, pitch: number, vel: number, rawVel?: unknown): void;
  export function extNoteOffAllImpl(S: any, state: any, deps: any): void;
}

declare module "@tool-ui/ui_recording_workflow.mjs" {
  export function createRecordingWorkflowState(): any;
  export function clearRecordingNoteBuffers(S: any, workflowState: any): void;
  export function clearPendingPrerollRecording(S: any): void;
  export function disarmRecordImpl(S: any, workflowState: any, deps: any): void;
  export function handoffRecordingToTrackImpl(S: any, workflowState: any, deps: any, newTrack: number): void;
}

declare module "@tool-ui/ui_drum_lane_workflows.mjs" {
  export function copyDrumClipImpl(S: any, deps: any, srcT: number, srcC: number, dstT: number, dstC: number): void;
  export function copyDrumLaneImpl(S: any, deps: any, track: number, srcLane: number, dstLane: number): void;
  export function cutDrumClipImpl(S: any, deps: any, srcT: number, srcC: number, dstT: number, dstC: number): void;
  export function cutDrumLaneImpl(S: any, deps: any, track: number, srcLane: number, dstLane: number): void;
  export function handleDeleteDrumLaneClear(S: any, deps: any, track: number, lane: number, options?: any): boolean;
  export function handleDrumLaneCopyPaste(S: any, deps: any, track: number, lane: number): boolean;
  export function handleDrumLaneFactoryReset(S: any, deps: any, track: number, lane: number): boolean;
  export function handleDrumLaneMuteSolo(S: any, deps: any, track: number, lane: number): boolean;
}

declare module "@tool-ui/ui_track_selection_workflow.mjs" {
  export function clipIsEmptyImpl(S: any, deps: any, track: number, clip: number): boolean;
  export function focusedClipIsEmptyImpl(S: any, deps: any, track: number): boolean;
  export function switchActiveTrackImpl(S: any, deps: any, track: number): void;
  export function selectTrackGestureImpl(S: any, deps: any, track: number): void;
}

declare module "@tool-ui/ui_track_convert_workflow.mjs" {
  export function trackHasAnyDataImpl(S: any, deps: any, track: number): boolean;
  export function convertTrackTypeImpl(S: any, deps: any, track: number, toDrum: boolean): void;
  export function closeConvertConfirmImpl(S: any): void;
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

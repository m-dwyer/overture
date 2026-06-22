# Current Architecture: `overture/overture-ui/ui`

This document describes the current implementation of `overture/overture-ui/ui` as observed in source. It is intentionally descriptive: it records current subsystem boundaries, ownership patterns, coupling points, and architectural smells without proposing refactors.

## Major Subsystems

### Composition Root and Host Entrypoints

`ui.js` is the composition root. It imports constants, shared Schwung utilities, the global state singleton, rendering modules, input workflows, tick workflows, persistence, sync, MIDI, pad, performance, and co-run workflows. It installs the public host callbacks on `globalThis`:

- `globalThis.init`
- `globalThis.tick`
- internal MIDI routing through wrappers around `_onCC_*`, `_onPadPress`, `_onPadRelease`, and step-button handlers
- `globalThis.__overtureResetState` for headless test teardown

`ui.js` also memoizes long-lived runtime objects such as the render surface, text keyboard, pad surface runtime, parameter page runtime, and track/clip sync facade. Most feature modules expose `*Impl` functions that take `S` and dependency bags, while `ui.js` builds those dependency bags from host globals, constants, and local wrapper functions.

### Core State and Constants

`core/ui_state.mjs` owns the live singleton `S`, created by `createInitialState()`. It holds almost every UI, DSP mirror, modal, interaction, LED, recording, persistence, and deferred-work flag. `resetUiState()` mutates the singleton in place for tests so import holders retain the same object reference.

`core/ui_constants.mjs` owns hardware constants, track/pad counts, bank definitions, formatting helpers, colors, and layout-level values. Many modules import these directly.

`core/ui_routes.mjs`, `core/ui_scene.mjs`, `core/ui_motion.mjs`, `core/ui_sound_edit*.mjs`, and route-check helpers provide domain-specific derivations and sound-edit behavior, but they still generally read or write `S` directly.

### Input Workflows

Input is split into routing plus ordered feature handlers:

- `midi/ui_midi_internal_workflow.mjs` parses MIDI status/data bytes, applies modal swallow rules, and dispatches to CC, step, pad, release, knob-touch, and aftertouch handlers.
- `input/ui_input_dispatch_workflow.mjs` fans CC events across jog, buttons, transport, side buttons, step edit, and knobs. Each handler ladder is priority ordered and returns once a context consumes the event.
- `input/ui_jog_cc_workflow.mjs`, `ui_button_cc_workflow.mjs`, `ui_transport_cc_workflow.mjs`, `ui_knob_cc_workflow.mjs`, navigation, side-button, and knob-touch modules implement behavior for specific hardware controls.
- `pad/ui_pad_workflow.mjs`, `pad/ui_pad_surface.mjs`, and aftertouch handling own pad-grid interpretation, live-note dispatch, drum lane selection, velocity zones, repeat modes, and melodic note entry.

The dispatch model is explicitly order-sensitive. Modal and overlay contexts are checked before normal navigation or editing, and many comments describe ordering as behavior-preserving or load-bearing.

### Tick Scheduler

`tick/ui_tick_workflow.mjs` is the per-tick orchestrator. It increments `S.tickCount`, expires overlays, drains queues, polls DSP, reconciles co-run, updates LED state, flushes recording events, persists state, prunes orphan state files, and redraws when `S.screenDirty` is true.

Most actual tick tasks live in `tick/ui_tick_tasks.mjs`. The tasks include:

- live-note queue drain
- deferred drum note-offs
- external route queue drain
- pad-map self-heal
- default `set_param` drain
- DSP mirror resync
- Move co-run injection sequencing
- undo/redo resync
- deferred lane/content readback
- set-load handling
- overlay timer expiry
- session hold-to-save
- transport and view LED updates
- suspend detection
- recording queue flush

The tick layer is the main place where work is deliberately delayed to avoid host/DSP coalescing or to wait for audio-thread state to settle.

### Rendering

OLED rendering is routed by `render/ui_screen_router_workflow.mjs`. It is a priority state machine over `S`:

1. Co-run states can cause Overture to skip drawing.
2. Modal/picker/prompt states take over the whole screen.
3. Menu and tap-tempo surfaces take over.
4. Sound edit and performance mode take over.
5. Splash/loading takes over.
6. Session View or Track View idle/edit/bank surfaces render.

Individual render modules own specific screens: idle views, session overview, performance view, popups, prompts, modals, loop view, step edit, CC step edit, bank overview, sound edit, and OLED layout helpers.

`render/ui_render_surface.mjs` builds a render surface around host drawing primitives and local helper functions. Some render modules receive this surface; others still import globals or constants directly.

### Persistence and Snapshots

Persistence is under `persist/`:

- `ui_persistence.mjs` owns active-set paths, sidecar paths, state save/clear helpers, action popups, name index, snapshot manifest, snapshot commit/apply/drop, and state-file copying.
- `ui_snapshot_workflow.mjs` owns snapshot picker flow and confirmation state.
- `ui_inherit_picker_workflow.mjs` owns duplicate-set inheritance detection and resolution.
- `ui_export.mjs` owns Ableton export request/confirm/poll flow.

Persistent UI-side state is stored in a sidecar keyed by the active set UUID. DSP state is saved/loaded through host parameters and files under Schwung set-state paths.

### DSP Sync and Clip Operations

`sync/` owns most DSP mirror reads and structural edit commands:

- `ui_clip_state_sync.mjs` reads global clip/session/mute/solo/UI sidecar state from DSP and files.
- `ui_clip_track_sync.mjs` reads per-track, per-clip, drum-lane, automation, bank-param, route, and arp-step state from DSP.
- `ui_clip_edit_ops.mjs` performs clear/copy/cut/reset/select/double-fill operations, updating both DSP commands and the JS mirror.
- `ui_track_clip_sync_facade.mjs` assembles sync operations behind a facade.
- `ui_polldsp_workflow.mjs` polls playback, playhead, merge, recording, and deferred-save state.

The JS mirror often updates optimistically when commands are sent, then schedules deferred readbacks to reconcile with DSP.

### Performance, Recording, MIDI, Drum, Bank, and Co-run

Other major feature folders:

- `perform/` owns live note sending, recording, latch/performance modifiers, tap tempo, transpose, loop gestures, mute/solo, and recording queues.
- `midi/` owns internal MIDI routing, external MIDI input, and external MIDI remapping.
- `drum/` owns drum clip/lane sync, lane copy/clear/reset/mute/solo, repeat modes, and repeat groove edits.
- `bank/` owns legacy parameter page runtime logic, page reset, page reads, track config writes, and page param writes.
- `corun/` owns Schwung chain-editor co-run and Move-native co-run entry/exit.

## State Ownership

### Primary Owner: `S`

The dominant state owner is the singleton `S`. It includes:

- transport and playback mirrors: `playing`, `masterPos`, `trackCurrentStep`, `trackClipPlaying`, queued clips, pending stops
- track/session focus: `activeTrack`, `sessionView`, `sceneRow`, `activeBank`, per-track active banks
- clip mirrors: step grids, clip length, loop start, TPS, playback direction, non-empty flags
- drum mirrors: lane steps, lane notes, active lane, lane length/TPS, lane mute/solo, repeat state
- pad state: pad key/scale/octave/map, scale set, layout, pressure mode
- bank and automation state: `bankParams`, CC assignments/types, CC lane loops, automation bits/rest values, aftertouch flags
- modal and overlay state: confirm flags, pickers, menu state, tap tempo, popups, sound edit page, splash
- modifier/input state: held buttons, copy source, delete/mute/capture/sample flags, knob touch/turn state
- recording state: record armed/count-in/pending page, recording buffers, preroll queues
- persistence/deferred work state: pending set load, pending sync, pending saves, pending defaults, snapshot copy
- LED state gates: initialization queue/index, co-run LED latches, dirty flags

This means most modules do not own isolated state. They own behavior over slices of `S`.

### Secondary Runtime State Outside `S`

Some runtime state is intentionally outside `S`:

- `ui_recording_workflow.mjs` defines `RecordingWorkflowState`, including live-note recording maps and drum recording queues. The comments identify this as a direction toward concept-owned state.
- `pad/ui_pad_surface.mjs` creates pad runtime state (`padPitch`, `padPressTick`) and live-note queues.
- `render/ui_leds.mjs` keeps module-local LED caches: last sent note LEDs, last sent button LEDs, and sound knob brightness cache.
- `ui.js` holds memoized runtime objects and module-local queues/facades.

### DSP-Owned State Mirrored in `S`

DSP is the authoritative owner for many musical facts. UI reads them through `host_module_get_param` and mirrors them into `S`: clip steps, lengths, active clips, queued clips, playback position, mutes/solos, bank snapshots, drum lane metadata, route/channel config, recording state, merge state, automation, and state UUID/version.

The UI is sometimes optimistic: edit commands update `S` immediately, then schedule `pendingStepsReread`, `pendingDrumResync`, `pendingDrumLaneResync`, `pendingUndoSync`, `pendingDspSync`, or other deferred reads.

### Sidecar-Owned State

Some state is UI-owned and persisted in the sidecar rather than the DSP state:

- active track and session/track view
- active clip focus mirror
- active drum lanes
- beat-marker preference
- performance latch/mod snapshots
- drum velocity-zone armed flags
- drum euclidean counts
- track octave
- per-track active bank
- aftertouch mode
- pad chromatic layout

## Input Handling

Internal MIDI input is first normalized by `handleUiMidiInternalMessage`. It applies high-level gates:

- aftertouch is handled before the generic noise filter
- master volume/touch pass through
- snapshot picker and clear-automation menu swallow unrelated input
- session overlay accepts only release/scroll
- knob touch notes `0..9` route to knob-touch handling
- CC routes to the CC dispatcher
- step button note-ons route to step-button handling
- pad note-ons and note-offs route to pad press/release handling

CC dispatch fans each CC through all relevant ladders. For jog input, the order is especially important: interval-exit, pickers, clear automation, bake/confirm dialogs, tap tempo, global menu, sound page, reset gestures, interval toggle, alt toggle, then free movement.

Pad input distinguishes Session View and Track View. Session View pads trigger clip/session operations. Track View pads branch by drum/melodic mode, co-run state, repeat mode, capture/delete/copy/mute modifiers, live-note behavior, and step-edit state.

Transport buttons also carry modal behavior. Back closes topmost surfaces before suspend/hide. Undo and Shift+Undo are undo/redo. Play supports stop/play/restart/panic/metronome/restart-at-page depending on modifiers. Record has blocked-recording dialogs, count-in, adaptive recording, and page-boundary scheduling.

## Rendering

`drawUIImpl` is the top-level OLED router. It has early returns for full-screen owners and overlays. Screen state is not modeled as an enum; it is inferred from many flags and objects on `S`. Priority order is encoded directly in the `if` ladder.

Track View rendering is also priority based:

- compress-limit notice
- action popup
- no-note flash
- Shift step help
- held-step edit
- loop view
- arp-step interval overlay
- CC/motion idle view
- param peek or bank overview
- drum/melodic idle views

Rendering uses `S.screenDirty` as the main redraw trigger. Many workflows call `forceRedraw()`, which sets dirty state and immediately updates LEDs if initialization is complete.

OLED and LED rendering are separate but coupled through shared state and update timing. The tick workflow updates LEDs every tick after initialization, while OLED redraw is conditional on `S.screenDirty`.

## Menu Navigation

The global menu is built by `menu/ui_global_menu.mjs` using shared Schwung menu primitives:

- `createValue`
- `createEnum`
- `createToggle`
- `createAction`
- `createDivider`
- `createMenuState`
- `createMenuStack`
- `handleMenuInput`

`buildGlobalMenuItemsImpl` returns a flat list of descriptors whose closures read/write `S` and call dependency functions. Some items are conditional on active track mode or route, such as aftertouch and Edit Sound.

Menu state lives in `S.globalMenuOpen`, `S.globalMenuItems`, `S.globalMenuState`, `S.globalMenuStack`, and `S.globalMenuBuiltForTrack`. `ensureGlobalMenuFreshImpl` rebuilds the menu when the active track changes while preserving selection by label when possible.

Menu rendering is in `menu/ui_dialogs.mjs`, not only menu-list rendering. It also renders tap tempo, route check, clear session, save state, convert-to-drum, export, and export-done surfaces when those flags are active.

Shift+step shortcuts can jump into specific menu labels or open related shortcut surfaces. The shortcut logic closes existing shortcut surfaces before opening a new menu target.

## Modal Behaviour

Modal behavior is represented by many independent flags and objects on `S`, not by a single modal stack. Examples:

- `pendingInheritPicker`
- `snapshotPicker`
- `clearAutoMenu`
- `confirmStateWipe`
- `recordBlockedDialog`
- `confirmLgto`
- `confirmXpose`
- `confirmBake`
- `confirmBakeScene`
- `confirmClearSession`
- `confirmSaveState`
- `confirmConvertToDrum`
- `confirmExport`
- `routeCheckOpen`
- `exportDoneDialog`
- `tapTempoOpen`
- `globalMenuOpen`
- `schwungSoundPage`

Modal rendering priority is centralized mostly in `drawUIImpl` and `drawGlobalMenu`. Modal input priority is distributed across `handleUiMidiInternalMessage`, `handleUiJog*`, transport Back handling, Sample cancellation, NoteSession/Menu handling, and feature-specific handlers.

Many modals are multi-phase state machines encoded as additional fields. For example bake confirm uses fields for drum vs melodic, multi-loop, loop count, wrap phase, selected option, drum mode, and target track/clip.

Back handling is partial and explicit: `handleUiBackButton` closes a known list of surfaces. Some surfaces use Menu or other gestures as the supported exit, especially Schwung Sound and co-run surfaces.

## LED Handling

LED output is concentrated in `render/ui_leds.mjs` plus initialization in `render/ui_led_init_workflow.mjs`.

There are two hardware write paths:

- note LEDs through `setLED`
- button/CC LEDs through `setButtonLED`

`ui_leds.mjs` keeps caches (`lastSentNoteLED`, `lastSentButtonLED`) and exposes `invalidateLEDCache()`. Some writes are cached, while co-run and other reclaim paths force re-sends.

LED initialization builds a queue of hardware note/CC identifiers and drains it over multiple frames using `LEDS_PER_FRAME`. Initialization must finish before normal LED updates run. It also pushes a scratch palette entry and reapplies the palette.

LED ownership is conditional:

- Session View pads show scene/clip state.
- Track View step LEDs show step content, loop pages, CC automation gradient, shift hints, copy-source blink, gate overlays, or co-run exit affordance.
- Track pads show melodic scale, active notes, drum lanes, repeat modes, velocity zones, latch highlights, and shift track-switch hints.
- Side buttons show scene flashes in Session View, track identity in Track View, and co-run slot/Move-track indicators in co-run.
- Knob LEDs show active track, bank dirtiness, automation state, performance loopers, sound-edit parameter brightness, or shift modifiers.

Co-run LED handling is a major special case. Overture suppresses or force-reclaims LED writes when Schwung chain editor or Move-native UI owns parts of the surface. Palette reapplication and cache invalidation are used when exiting co-run because the other layer may have changed hardware LED state.

## Undo/Redo Handling

Undo availability is UI-tracked using `S.undoAvailable` and `S.redoAvailable`. Most structural/editing commands set `undoAvailable = true`, `redoAvailable = false`, and clear `undoSeqArpSnapshot`.

Undo is triggered by the Undo button. Shift+Undo triggers redo. The actual restore command is sent to DSP through:

- `setParam('undo_restore', '1')`
- `setParam('redo_restore', '1')`

After an undo/redo command, `S.pendingUndoSync = 5`. The tick task later reads `last_restore`, calls targeted clip sync, re-establishes recording if necessary, clears stale recording buffers, invalidates LED cache, and redraws.

SEQ ARP bank state has a special UI-side snapshot path because comments indicate DSP undo/redo does not restore that per-clip pfx state. Undo/redo swaps `undoSeqArpSnapshot` and `redoSeqArpSnapshot` and reapplies `S.bankParams[track][4]` from the saved snapshot.

Undo/redo is not a centralized command abstraction. Each edit path manually marks availability and schedules any needed readback.

## Audio Engine Boundaries

The primary audio engine boundary is the host parameter API:

- `host_module_set_param(key, value)` sends commands and state changes to DSP.
- `host_module_get_param(key)` reads DSP state and readback snapshots.

UI commands are string-key/string-value based. Examples include:

- transport commands: `transport = play`, `stop`, `restart`, `panic`, `restart_at:...`, `play_focus:...`
- clip commands: `tN_cM_clear`, `clip_copy`, `row_copy`, `bake`, `bake_scene`
- recording commands: `tN_recording`, `record_count_in`, `tN_record_note_on`, `tN_drum_record_note_on`
- live notes: `tN_live_notes`
- bank/track config: `tN_channel`, `tN_route`, `tN_pad_mode`, bank-specific pfx params
- state commands: `state_load`, `save`, snapshot copy/apply flows

The implementation is sensitive to host coalescing. Comments repeatedly state that multiple `set_param` calls in one audio buffer can coalesce, sometimes regardless of key. Current mitigations include:

- `S.pendingDefaultSetParams`, drained one per tick
- `S.clearDrainHold`
- tick-batched live note queues
- tick-batched recording queues
- delayed readbacks such as pending steps reread and drum resync
- atomic DSP commands that combine multiple semantic operations into one payload

Other host/shim boundaries include:

- `shadow_*` APIs for co-run, flags, Schwung slots, chain params, sound edit, pad snapshots, and patched capability detection
- `move_midi_inject_to_move` for Move-native injection
- `move_midi_external_send` for external MIDI
- `move_midi_internal_send` for palette SysEx
- host file APIs for persistence
- display primitives `print`, `fill_rect`, `clear_screen`

Routes are modeled as Schwung, Move, or External. Live note dispatch chooses between queued DSP live notes, external send, Move route payloads, and Schwung shadow MIDI depending on route and message type.

## Coupling Points

### `ui.js` as Hub

`ui.js` is coupled to almost every subsystem. It imports feature modules, exposes host callbacks, creates dependency bags, owns runtime singletons/queues/facades, wraps host globals, and bridges feature workflows together.

### Global `S`

Most subsystems couple through direct mutation of `S`. A change in modal flags, recording fields, route config, bank params, or clip mirrors can affect input routing, rendering, LED output, tick tasks, and DSP sync.

### Ordered Handler Ladders

Input correctness depends on explicit ordering in jog, CC, transport, pad, and MIDI routers. Adding a new modal or gesture requires placing it correctly in multiple ladders.

### String-Based DSP Protocol

UI and DSP are coupled by parameter key names, payload formats, timing assumptions, and coalescing behavior. There is no typed boundary in the UI layer beyond comments and local parsing.

### Mirrored State and Optimistic Updates

Many operations update `S` and DSP separately, then rely on deferred readback. This couples edit workflows, sync workflows, tick timing, render freshness, and LED invalidation.

### Modal Flags Across Render and Input

Modal state is spread across `S`, render router, jog handlers, Back handling, MIDI swallow rules, and menu drawing. The same modal may be represented by one flag, several selection fields, and hidden assumptions in handler priority.

### LED and Render Coupling

LED rendering and OLED rendering share view state but are not a single rendering pass. LED updates also reach host hardware directly and manage cache invalidation, force sending, palette updates, and co-run conflicts.

### Host Globals

Many modules use dependency bags, but some still import shared Schwung modules by absolute device paths or call host globals directly through imported helpers or local functions. `ui.js` resolves optional host functions repeatedly when building dependency bags.

### Co-run Cross-Cutting Behavior

Co-run affects input routing, OLED rendering, LED ownership, pad maps, palette state, modifier cleanup, Move MIDI injection, side buttons, and tick reconciliation. Its state is checked across render, LED, pad, input, tick, route, and sound-edit code.

## Architectural Smells

These are observed current-state smells, not proposed fixes.

- The singleton `S` is extremely broad. It mixes UI mode, DSP mirrors, hardware state, modal state, persistence state, recording queues, deferred task flags, and feature-specific state.
- Screen state is implicit. Rendering priority is encoded as ordered boolean checks rather than a single declared current surface or modal stack.
- Input dispatch is order-dependent across many long ladders. Behavior depends on early returns and duplicated modal checks.
- Modal ownership is fragmented. Rendering, input swallowing, jog behavior, Back cancellation, and state transitions for a modal can live in different files.
- DSP protocol is stringly typed. Parameter names and payload formats are manually assembled and parsed in many places.
- Host coalescing rules leak into many subsystems. Queues, delays, drain holds, and comments about buffer timing are spread through edit ops, recording, live notes, tick tasks, and menu flows.
- `ui.js` remains a large composition and orchestration hub despite modular `*Impl` extraction. It still knows most subsystem dependencies and behavior wiring.
- Feature modules frequently mutate unrelated slices of `S`. For example an input gesture can update modal flags, bank params, undo state, DSP queues, LED invalidation, and popup state in one handler.
- LED code combines presentation decisions, hardware caching, palette programming, co-run conflict handling, and view logic in one large module.
- Some boundaries are inconsistent. Many modules use injected dependencies, while others import `S`, shared device-path modules, or host-global wrappers directly.
- Undo/redo state is manual and decentralized. Edit paths individually mark availability and special cases such as SEQ ARP snapshots live outside DSP restore.
- Optimistic JS mirrors can diverge temporarily from DSP. Correctness depends on deferred readbacks and tick order.
- Co-run is cross-cutting and invasive. It introduces checks and cleanup paths across input, pad mapping, render, LEDs, sound edit, and tick workflows.
- Persistence, snapshot, sidecar, and active-set handling are interleaved with initialization, tick, menu actions, and suspend detection.
- Hardware-specific constants and assumptions are widely visible. MIDI CC/note ranges, Move button mappings, palette indices, and OLED dimensions appear across multiple layers.

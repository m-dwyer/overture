# Architecture Review Final

## 1. Executive Summary

I would not approve the proposed architecture as an implementation plan in its current form.

The current-state document is broadly accurate. The codebase really does have a large global `S`, an oversized `ui.js`, order-sensitive MIDI/input ladders, scattered DSP timing policy, pending readback flags, and LED/render ownership problems. The documents correctly identify the main pain points and correctly reject a rewrite.

The problem is that the target architecture responds with too many abstractions at once: normalized events, context stack, command descriptors, command bus, DSP operation queue, readback scheduler, nested state roots, render frames, LED frames, sidecar schemas, and feature/plugin registration. Individually, several are reasonable. As a package, they risk creating a second control plane next to the existing one before deleting any meaningful complexity.

The architecture also underweights the one boundary that is clearly justified by the source: DSP write/readback/timing. The code already contains repeated comments about coalescing, one-per-tick drains, delayed rereads, and direct-vs-deferred host writes. That is not theoretical architecture debt. That is active correctness risk. By contrast, broad context stacks, render frames, nested state roots, and feature registration are less clearly justified by the current implementation and should not be allowed to consume early refactor budget.

The migration plan is directionally careful, but still too optimistic. It assumes additive adapters are low risk. In this codebase, additive adapters are only low risk if they stay test-only or replace old paths quickly. Otherwise they increase the number of states, flags, queues, dispatch paths, and render owners that must agree.

My recommendation: narrow the first architecture wave to three things only:

1. Characterization tests for DSP-affecting behavior.
2. A DSP operation queue/protocol boundary that preserves current timing exactly.
3. One command family only if it deletes duplicated DSP/write/readback policy.

Everything else should be demoted to opportunistic migrations triggered by concrete implementation pain, not approved as a target architecture program.

## 2. Top 5 Architectural Concerns

### 1. The target architecture is too broad for the demonstrated problem

Severity: Critical.

The docs propose a full architecture vocabulary: app/dsp/runtime/context/render state roots, context stack, command descriptors, command bus, DSP queue, readback scheduler, render models, `ScreenFrame`, `LedFrame`, feature registry, sidecar schema registration, and capability-based plugins.

The source does not justify adopting all of that as a coordinated refactor. The codebase has many existing seams: `*Impl(S, deps)`, focused tests, `ui_track_clip_sync_facade.mjs`, `RecordingWorkflowState`, `PadSurfaceRuntime`, render modules, and tick tasks. The target should deepen the seams that already prove value, not install a full platform architecture.

The largest risk is architectural inflation: every future behavior change now has to decide whether it belongs in legacy workflow code, a context, a command, a queue, a scheduler, a frame, a feature registration, or a state root. That is implementation churn disguised as architecture.

### 2. The migration creates parallel systems before it removes old ones

Severity: Critical.

The plan repeatedly recommends compatibility modes:

- normalized events emitted but not consumed
- context stack instantiated but not routed
- command descriptors built but not executed
- DSP operation queue created with no production user
- readback scheduler introduced before broad pending-flag removal
- nested state roots added before fields move
- frame models added beside direct renderers

One or two compatibility bridges are reasonable. This many is not. The code already has too many coordination mechanisms. Adding inactive architecture surfaces will increase cognitive load, test setup, and failure modes without reducing runtime coupling.

The plan needs a hard rule: every architecture PR must either replace a production path or be deleted within the next one or two PRs. "Shell" abstractions should be rejected unless they remove or encapsulate existing behavior immediately.

### 3. DSP timing is correctly identified but not made dominant enough

Severity: High.

The source strongly supports a DSP boundary refactor. `ui_clip_edit_ops.mjs`, `ui_bank_params.mjs`, `ui_tick_tasks.mjs`, `ui_knob_cc_workflow.mjs`, recording, loop gestures, transport, and sync all write host params directly or push into `S.pendingDefaultSetParams`. Timing rules are encoded as comments and fields such as `clearDrainHold`, `pendingStepsReread`, `pendingDrumResync`, `pendingUndoSync`, and one-per-tick queue drains.

This is the real architectural fault line. It affects correctness on hardware, undo/redo, optimistic mirrors, recording, and user trust.

The ranking document says DSP Operation Queue has highest leverage but then recommends hardware event normalization and context migration before it. I disagree. Adapter-only normalized events are low risk, but they do not reduce the highest-risk coupling. Context work should not precede DSP timing work unless it is needed by an immediate feature.

The first implementation wave should prove the DSP queue/protocol boundary against current behavior before spending serious effort on contexts or rendering frames.

### 4. The context stack is over-specified and likely to churn

Severity: High.

A context stack is plausible for modals, but the proposed contract is too ambitious: input capture, screen capture, LED capture, lifecycle, Back behavior, command dispatch, render integration, bubbling, base contexts, overlays, modal contexts, and co-run contexts.

The current modal problem is real, but the proposed solution risks becoming a generic runtime with subtle priority semantics. The current code's priority ladders are ugly, but they are explicit. A context stack can make priority less visible unless the implementation is extremely small.

I would approve a modal controller for a single class of blocking modal only. I would reject putting base Session View, Track View, performance mode, overlays, and co-run into the same abstraction until the simple modal case has deleted real legacy code.

### 5. Feature/plugin registration is not justified by the current codebase

Severity: High.

The plugin API document is the weakest part of the architecture. It describes a registry of contexts, commands, reducers, renderers, tick tasks, DSP protocol, sidecar schemas, and tests. That is a framework.

The codebase does not need a framework yet. It needs fewer write paths, fewer top-level state fields, fewer dispatch priority lists, and clearer DSP timing. A plugin-style registry will make `ui.js` less explicit while not solving the hard parts. It also creates a new abstraction boundary before the underlying contracts are stable.

This should be rejected from the approved target. At most, keep it as a speculative future note.

## 3. Areas of Over-Engineering

### Plugin-style feature registry

Reject for now. The project has one application with tightly coupled hardware behavior, not a stable extension ecosystem. A registry would add indirection around contexts, commands, renderers, tick tasks, DSP protocol, and sidecar schemas before those concepts are proven.

### Broad state-root design

`S.app`, `S.dsp`, `S.runtime`, and `S.sidecar` are reasonable names, but adding roots before moving ownership is cosmetic. The current problem is not that fields lack folders. The problem is that mutation authority is unclear. Move one concrete ownership cluster first; add roots only when they carry fields and remove top-level access.

### ScreenFrame and LedFrame as target-wide rendering architecture

Frame rendering is useful for selected surfaces. It is not obviously worth converting the whole OLED and LED system. Existing render tests already assert many host calls, and some render modules are small. Broad frame conversion would generate large diffs, duplicated adapters, and visual regression risk.

Start with LED cache/palette/co-run adapter cleanup. That is the concrete pain. Do not assume a retained frame model is required.

### Full command descriptor model

The command descriptor shape is comprehensive: undo policy, DSP ops, mirror patch, sidecar patch, readbacks, invalidation, coalescing. That may be right for clip/scene/drum structural edits. It is too heavy as a general command model.

The architecture should explicitly limit commands to operations where the descriptor removes duplicated policy. If a command is just a wrapper around one function call plus `S.screenDirty = true`, reject it.

### Context stack for base contexts and overlays

Using contexts for blocking modals is defensible. Using them for base Session View, Track View, performance mode, overlays, and co-run is premature. It would turn normal navigation into a framework problem before the framework has earned trust.

### Sidecar schema registration

Schema validation is useful when persistence changes are happening. A schema registration system is not justified as an early architecture layer. The persistence code is not the highest-risk area compared with DSP timing and command/readback correctness.

## 4. Areas of Under-Engineering

### No hard deletion criteria for compatibility bridges

The plan talks about removing bridges but does not define enforcement. This is dangerous. Every bridge should have:

- the legacy code path it replaces
- the tests that prove parity
- the PR by which the old path must be deleted
- an owner for removing duplicated flags or adapters

Without this, the migration will leave the codebase with both old and new systems.

### Insufficient focus on direct host writes

The docs correctly identify stringly typed DSP calls, but the migration should start with an inventory of all `setParam`, `host_module_set_param`, and `pendingDefaultSetParams` write sites by category:

- immediate transport/performance writes
- one-per-tick coalescing-sensitive writes
- writes that require delayed readback
- writes coupled to optimistic mirror patches
- recording/live-note writes with special ordering
- co-run or route-specific writes

That inventory should gate the DSP queue design. Otherwise the queue API may be shaped around `pendingDefaultSetParams` and then fail on direct writes that intentionally bypass it.

### Missing architectural budget controls

The architecture should define what is not allowed in the first refactor wave. For example:

- no feature registry
- no broad render frame conversion
- no base context migration
- no nested state roots without field movement
- no command conversion outside one named family
- no readback scheduler until a production queued command needs it

The ranking document hints at this, but the transformation plan still includes too many phases as if they are all part of an approved roadmap.

### Weak treatment of `ui.js`

The docs say to keep `ui.js` as composition root, but `ui.js` is still 2500+ lines and contains wrappers, dependency construction, stateful runtime objects, host globals, and behavior. "Keep it as adapter" is not enough.

The architecture should define acceptable responsibilities for `ui.js`:

- install host callbacks
- construct runtime objects
- bind host capabilities
- delegate to workflows

Everything else should be classified as legacy behavior to extract opportunistically. Without that, new architecture objects may simply be wired into an already overloaded file.

### No explicit performance/non-hardware acceptance criteria

The architecture wants frame diffing, scoped invalidation, queues, contexts, and schedulers. On a constrained device integration, each needs acceptance criteria:

- no extra OLED redraws
- no LED write budget regressions
- no added per-tick allocation in hot paths
- no extra host param writes
- no delay added to live-note, recording, or transport flows

The docs mention hardware constraints but do not turn them into review gates.

## 5. Migration Risks

### Adapter-only normalized events may become dead architecture

Emitting normalized events while preserving raw dispatch is low risk but also low value unless a consumer appears immediately. It can be approved only if the next PR uses those events in tests or a real migrated path. Otherwise it is another vocabulary layer.

### Context migration can regress priority semantics

Modal behavior is distributed across MIDI swallow rules, jog, Back, render priority, menu handling, and feature handlers. Moving only one part to a context can create split ownership where the same modal is partly controlled by a context and partly by legacy flags. That is more dangerous than the current explicit ladders.

### Command bus execution can hide order-sensitive side effects

Current edit functions interleave DSP queue pushes, mirror mutation, active-note clearing, bank refreshes, undo flags, LED invalidation, launch fallback, and pending readbacks. A descriptor model may make this look declarative while still depending on exact order.

For migrated commands, tests must assert not just final state but operation order and tick timing.

### DSP operation queue can accidentally normalize behavior that must stay irregular

Some writes are immediate for a reason. Some are queued. Some are `unshift`. Some wait for `clearDrainHold`. Some are tied to recording or live-note drain ordering. A queue abstraction that treats all DSP ops uniformly will break behavior.

The first queue should be a compatibility wrapper around one existing drain, not a universal write path.

### Readback scheduler can duplicate pending flags

The code already has many pending counters. Adding a scheduler before deleting a real pending path creates two deferred-work systems. That is a classic migration trap. The scheduler should be introduced only when one pending flag is removed or fully encapsulated.

### Render frames can double test burden

If both direct drawing tests and frame tests exist for the same surface, the project pays twice. Frame conversion should retire or simplify old tests, not add another parallel assertion layer.

### Co-run context migration is especially risky

Co-run touches OLED suppression, LED reclaim, palette behavior, input pass-through, Move firmware interactions, pad maps, side buttons, step buttons, and tick timing. It should not be used as proof of the context abstraction until simpler cases have removed real code.

### Migration order is too optimistic

The ranking recommends:

1. Hardware Event Normalization
2. Context Stack plus confirm prompt
3. DSP Operation Queue compatibility mode

I would reorder:

1. DSP write/readback inventory and characterization tests
2. DSP Operation Queue compatibility mode for one existing drain
3. One production DSP write family through the queue
4. Optional command descriptors for that same family
5. Normalized events only if they immediately reduce input test complexity
6. Context stack only for one blocking modal after the DSP path is stable

The current ranking optimizes for low-risk visible architecture progress. The refactor should optimize for reducing the most dangerous coupling first.

## 6. Recommended Changes Before Implementation

1. Replace the broad roadmap with a narrow first-wave architecture contract.

The first wave should cover only DSP operation timing, command/readback policy for one family, and tests. Everything else should be explicitly out of scope.

2. Add a DSP write/readback inventory document.

Before designing the queue, classify all write sites and pending readbacks. Include direct writes, queued writes, `unshift` writes, recording/live-note drains, transport writes, bank writes, loop writes, and co-run writes.

3. Require deletion with every abstraction.

No architecture PR should add a shell unless the same PR or the next PR removes a legacy path. This applies to context stack, command descriptors, readback scheduler, render frames, and state roots.

4. Downgrade plugin API to rejected/future.

Remove it from the approved target architecture. The project should not design a plugin framework while core behavior ownership is still unstable.

5. Replace "nested state roots" with ownership migrations.

Do not add `S.app`, `S.dsp`, `S.runtime`, or `S.sidecar` as empty shells. Move a concrete owned cluster, update call sites, and then decide whether roots are needed.

6. Scope context stack to blocking modals only.

Approve only a minimal modal owner with render/input/Back for one modal. Do not include base contexts, overlay contexts, or co-run contexts in the initial abstraction.

7. Scope commands to DSP-affecting structural edits.

Do not build a generic command bus. Build command support only where it centralizes DSP ops, mirror patches, undo, readback, and invalidation that are currently duplicated.

8. Define hardware performance gates.

Each migration touching tick, LED, OLED, or DSP writes must prove no added writes, no redraw spam, no per-tick allocation regression in hot paths, and no behavior delay for live-note/recording/transport paths.

## 7. Architecture Decisions I Would Reject

### Reject: plugin-style feature registry

Not justified. It adds framework mechanics before stable contracts exist.

### Reject: broad ScreenFrame conversion

Use frame data only for surfaces where it deletes test pain or clarifies ownership. Do not approve a blanket rendering migration.

### Reject: LedFrame as a mandatory model

First isolate LED cache, palette programming, forced resend, and co-run suppression. A full LED frame may not be necessary.

### Reject: nested state roots without immediate field movement

Empty roots are architecture theater. Move ownership or do nothing.

### Reject: context stack covering base views and co-run in the first wave

Start with one blocking modal. Co-run is too special and too hardware-sensitive to validate a general context abstraction.

### Reject: readback scheduler before removing a pending flag

Do not create a second deferred-work system. Introduce it only when it fully owns one existing readback path.

### Reject: command descriptors without a near-term execution path

Descriptor-only code is acceptable for one PR at most. If it does not immediately drive execution or tests that prevent a risky migration, it is dead architecture.

### Reject: treating hardware event normalization as the default first migration

It is low risk, but not the highest-value first migration. Do it only if it immediately improves tests or unlocks a specific modal/input migration.

## 8. Architecture Decisions I Strongly Agree With

### Agree: no rewrite

The current code contains real hardware knowledge. A rewrite would lose timing behavior and edge cases.

### Agree: preserve `*Impl(S, deps)` seams

These are already valuable. They support focused tests and dependency injection without forcing a new framework.

### Agree: DSP timing must become explicit

This is the strongest architectural argument in the docs. Host coalescing, one-per-tick drains, optimistic mirrors, and delayed readbacks need a clearer owner.

### Agree: do not turn every input into a command

Commands should be reserved for user-visible state changes, especially DSP-affecting edits. Transient input, pressure, live notes, pass-through, and render invalidation should stay out.

### Agree: co-run should be delayed

Co-run is too cross-cutting and device-specific to migrate early. Characterize it first; abstract it last.

### Agree: LED cache behavior must be preserved

The existing LED system is messy but hardware-aware. Any refactor must preserve caching, forced resend, initialization, palette behavior, and co-run reclaim.

### Agree: broad render-frame conversion is probably unnecessary

The ranking document is right to delay or avoid full conversion. Rendering should be refactored surgically.

### Agree: Recording Workflow and Pad Surface are good concept-owned state examples

These modules already show the direction the architecture should prefer: deepen proven concept modules instead of adding generic layers above them.


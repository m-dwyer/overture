# Schwung Modules As First-Class Overture Citizens

## Status

Architecture follow-up from the Schwung Sound page spike.

The spike proved that Schwung-routed tracks can expose an Overture-owned Sound page while Schwung remains the audio/module backend. Overture now owns the common Sound workflow for module selection and generic parameter editing, and preserves Schwung's chain editor as the deep-edit path.

## Problem

Tracks 5-8 can route to Schwung modules, but the user experience still leaks the backend boundary:

- module selection is only the first layer of sound ownership;
- bespoke module interfaces still live in Schwung's chain editor;
- input ownership is split, especially the physical Back/`<` button returning to stock Move;
- module names and identities have a small Overture model, but categories, capability flags, and slot state still need broader real-module coverage;
- missing slots and backend capability gaps need consistent Overture-facing states.

If Schwung tracks are meant to feel like native Overture tracks, users should not need to think in terms of “jumping into Schwung” for common sound work.

## Current Spike Result

Implemented and device-verified:

- `Shift + Step 3` on Schwung-routed tracks opens an Overture Sound page.
- Overture can browse and apply modules for:
  - `midi_fx1:module`
  - `synth:module`
  - `fx1:module`
  - `fx2:module`
- Current module names refresh from Schwung params.
- The browser opens on the currently loaded module.
- `Shift + jog-click` on a selected component opens an Overture-owned parameter detail page.
- When a selected Schwung track has playable params, `Shift + Step 3` opens directly into parameter detail instead of stopping at the component overview.
- While the Sound page is active, Step 1-4 jump directly to MIDI FX, Synth, FX 1, and FX 2; components with visible params open in detail immediately.
- Overture remembers the selected component and param bank per track.
- Parameter detail uses Schwung's declared `ui_hierarchy` when available, enriched with `chain_params` metadata.
- If no curated hierarchy is available, Overture falls back to `chain_params`.
- Detail pages follow Move/moveforge encoder-bank behavior: eight encoders edit the active bank.
- `ui_hierarchy.levels.root.knobs` order is treated as the preferred encoder mapping when present; otherwise declared params are used in order.
- Jog switches encoder banks when a component exposes more than eight mapped params.
- K1-K8 edit the active bank.
- Numeric, enum, and bool params are written through `shadow_set_param(slot, "<component>:<param>", value)`.
- String, filepath, and canvas params are visible but intentionally read-only in Overture.
- Parameter touch/turn feedback uses an Overture-owned focused param-peek view instead of debug CC/key diagnostics.
- Helm was tested on device with curated params and encoder editing.
- `Deep Edit` preserves access to Schwung's existing chain editor.
- `Menu` is the supported Sound page exit. Back/`<` is intentionally unclaimed for this page until there is an input ownership hook.
- Move-native tracks keep their existing co-run behavior.
- Schwung remains untouched and pinned to upstream v0.9.18.

Current implementation shape:

- Overture keeps the public Sound workflow facade in `ui/core/ui_sound_edit.mjs`.
- Module/parameter normalization and edit math live in `ui/core/ui_sound_edit_model.mjs`.
- OLED rendering lives in `ui/core/ui_sound_edit_render.mjs`.
- Input dispatch continues to call the facade functions, including Sound-page Step 1-4 component selection, so public behavior stays owned by Overture.

Known limitation:

- Physical Back/`<` exits to stock Move from this context. Without a Schwung-side input ownership hook, Overture cannot safely claim it as a Sound page back action.
- File/string/canvas params need bespoke editors before they should become writable from Overture.
- The Sound detail focused peek is functional; broader OLED polish should come from more real-module sweeps rather than speculative layout work.
- Remaining device sweep targets:
  - one moveforge synth;
  - one upstream Schwung synth;
  - one audio FX;
  - one MIDI FX.
- Overture still depends on current Schwung APIs returning usable identity and metadata:
  - `<component>:module` / `*_module`
  - `<component>:ui_hierarchy`
  - `<component>:chain_params`

## Goals

- Make Schwung-routed tracks feel owned by Overture for common sound tasks.
- Keep Schwung as the backend module host.
- Preserve Schwung chain editor access for deep editing.
- Avoid broad Schwung forks. Any Schwung change should be small, capability-gated, and upstreamable.
- Make backend capability gaps explicit in Overture UI rather than failing silently.

## Non-Goals

- Booting directly into Overture.
- Replacing Schwung's chain editor.
- Reimplementing Schwung's module host in Overture.
- Changing Schwung shared-memory layouts unless there is no smaller capability hook.
- Making tracks 5-8 Move-native.

## Product Direction

### 1. Sound Page Ownership

Overture should own the quick Sound workflow:

- show active slot identity for the selected track;
- show loaded module names;
- browse compatible modules by component type;
- apply selected module;
- expose an obvious `Deep Edit` path.

The Sound page should remain a navigation/list UI, not a parameter bank.

### 2. Module Identity Model

Overture needs a small model for Schwung modules:

- stable module id;
- display name;
- component type;
- category/group if available;
- optional vendor/source;
- installed/available status;
- capability flags for browser, params, presets, and deep edit.

This can initially be populated from existing host APIs. If that is insufficient, add a Schwung hook that returns the same module list Schwung's picker uses.

### 3. Slot Ownership

Overture should treat each Schwung slot as a track sound endpoint:

- track channel maps to Schwung slot;
- missing slot shows an actionable state;
- slot changes should refresh Overture state;
- slot/module params should be read through capability-gated APIs;
- param writes should be guarded by resolved slot validity.

### 4. Parameter Surface

First-class does not require exposing every module parameter immediately.

Current stage:

- curated `ui_hierarchy` params are preferred;
- `chain_params` supplies ranges, steps, enum options, and fallback ordering;
- the default Sound entry is parameter-first when a component has visible params;
- generic numeric, enum, and bool editing is Overture-owned through active encoder banks;
- touched/turned params temporarily replace the bank grid with a focused param-peek view showing name, value, range/status, and knob number;
- string, filepath, and canvas params remain visible/read-only;
- bespoke module UIs remain in Schwung Deep Edit.

Potential next stages:

1. Improve metadata coverage across moveforge/Schwung modules.
2. Add explicit read-only affordances for string/file/canvas params.
3. Add focused editors for filepath/string params only when the UX is clear.
4. Keep module-specific visual/canvas editors in Schwung unless modules declare enough metadata to render them safely in Overture.

### 5. Input Ownership

Current safe rule:

- `Menu` exits the Overture Sound page.
- Back/`<` is not advertised as an Overture Sound exit.

Desired future behavior:

- Overture can claim Back/`<` while its Sound page is active.
- Schwung can block that input from reaching stock Move while still forwarding it to the active overtake tool.

This likely requires a minimal Schwung capability hook or input ownership mode. It should be scoped to active overtake tools and should not change Move-native co-run behavior.

## Minimal Schwung Hooks To Consider

Only add these if Overture cannot do the job through existing APIs:

- `shadow_list_modules_for_component(componentType)`:
  - returns module ids, names, and metadata for Schwung's installed picker list.
- input ownership capability for overtake tools:
  - lets a tool claim Back/`<` while active;
  - prevents claimed input from reaching stock Move;
  - still forwards the event to the tool UI.
- optional module metadata hook, if existing params prove too inconsistent:
  - exposes declared params, presets, display categories, and read-only/editor capability flags.

All hooks should be capability-gated from Overture with `typeof hook === "function"` checks.

## Open Questions

- Should tracks 5-8 always be Schwung-owned, or should Overture support mixed backend assignment per track?
- Should `Deep Edit` remain a Sound page row, or move to a secondary action/menu once the page grows?
- How far should Overture go with filepath/string editors before it becomes a second Schwung UI?
- Should Back/`<` support wait for an upstream Schwung hook, or should Overture continue documenting Menu-only exit?
- What is the minimum module metadata needed to make browsing feel polished?

## Suggested Next Milestones

1. Run the remaining device sweep across one moveforge synth, one upstream Schwung synth, one audio FX, and one MIDI FX.
2. Broaden module fixture coverage for `ui_hierarchy` and `chain_params` shapes seen in real modules.
3. Draft a small upstream Schwung issue/PR for input ownership if Back/`<` should become an Overture Sound page action.
4. Decide whether module enumeration needs `shadow_list_modules_for_component(componentType)` or the current host list path is enough.
5. Add bespoke editors only for read-only param families that have a clear Overture UX.

# Schwung Modules As First-Class Overture Citizens

## Status

Draft follow-up from the Schwung Sound page spike.

The spike proved that Schwung-routed tracks can expose an Overture-owned Sound page for quick module selection while Schwung remains the audio/module backend. The next step is to decide what “first-class” means beyond selecting `MIDI FX`, `Synth`, `FX 1`, and `FX 2`.

## Problem

Tracks 5-8 can route to Schwung modules, but the user experience still leaks the backend boundary:

- module selection is only the first layer of sound ownership;
- deeper module parameters still live in Schwung's chain editor;
- input ownership is split, especially the physical Back/`<` button returning to stock Move;
- module names, identities, categories, and slot state are not yet modeled as Overture concepts;
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
- `Deep Edit` preserves access to Schwung's existing chain editor.
- `Menu` is the supported Sound page exit.
- Move-native tracks keep their existing co-run behavior.

Known limitation:

- Physical Back/`<` exits to stock Move from this context. Without a Schwung-side input ownership hook, Overture cannot safely claim it as a Sound page back action.

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

Potential stages:

1. Module selection only.
2. Show a read-only summary of key chain params.
3. Add an Overture-owned generic param page for declared `chain_params`.
4. Keep bespoke module UIs in Schwung Deep Edit unless modules declare enough metadata to render them safely in Overture.

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
- optional module metadata hook:
  - exposes declared params, presets, and display categories.

All hooks should be capability-gated from Overture with `typeof hook === "function"` checks.

## Open Questions

- Should tracks 5-8 always be Schwung-owned, or should Overture support mixed backend assignment per track?
- Should `Deep Edit` remain a Sound page row, or move to a secondary action/menu once the page grows?
- How far should Overture go with generic module parameter editing before it becomes a second Schwung UI?
- Should Back/`<` support wait for an upstream Schwung hook, or should Overture continue documenting Menu-only exit?
- What is the minimum module metadata needed to make browsing feel polished?

## Suggested Next Milestones

1. Document the final spike behavior and limitation in user-facing docs.
2. Add Overture module identity types and normalize current module-list results.
3. Add a compact module detail view for current slot state.
4. Prototype generic `chain_params` rendering for one synth and one FX.
5. Draft a small upstream Schwung issue/PR for input ownership and module enumeration, if existing APIs prove insufficient.


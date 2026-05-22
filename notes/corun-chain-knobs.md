# Schwung chain-edit co-run — knob exposure (2026-05-22)

**Branch:** `corun-chain-knobs` on both `~/schwung` (fork) and `~/schwung-davebox`.
**Status:** Implemented + deployed + **hands-on verified** (turn, touch-peek, and
exit all working). Resolves the parked feature from
`project_chain_edit_corun_knob_regression`. Line numbers re-derived against the
post-rebase fork (`a73ebe89`).

## The ask (delivered)

While a dAVEBOx track co-runs Schwung's chain editor (`Edit Slot…`), the knob row
(K1–K8 / CC 71–78) drives the **focused chain component's parameters**, same as
the native chain editor — **both turn and capacitive touch**:
- **Turn** → adjust the param (with the slot-global knob-macro fallback at the
  chain top level).
- **Touch** → value-peek overlay; **release** dismisses cleanly.

## How co-run input routing works (verified, current code)

`onMidiMessageInternal` in `src/shadow/shadow_ui.js` has two regions:

- **Overtake/co-run region** (a tool is loaded as `OVERTAKE_MODULE`):
  - Co-run intercept block (`if (coRunChainEditSlot >= 0 && status === 0xB0)`):
    jog turn, jog click, Back, Shift, Menu, track buttons, **and now knob CCs**
    → routed to the chain editor via `runCoRunChainEdit(...)`. Each `return`s.
  - Below it: remaining CCs are accumulated for the tool (`overtakeKnobDelta[]`)
    and flushed to dAVEBOx before tick.
  - Everything else (notes incl. knob-touch 0–7, pads, steps, transport) is
    forwarded to the tool, then `return`. **Knob-touch handling is inserted just
    before this forward and falls through (no return)** so the tool still gets
    both touch edges.
- **Non-overtake region**: the editor's own native handlers. Knob turn does
  `adjustKnobAndShow(idx, delta)` then `handleKnobTurn(idx, delta)` fallback;
  touch-on does `showKnobOverlay`/multi-marker; touch-off drains `pendingHierKnob`
  + `pendingKnob`. **These are the paths we mirror.**

### The view-cache trap (why the drain wrap is mandatory)

Editor knob pipeline: `adjustKnobAndShow` accumulates into `pendingHierKnobDelta`
→ `processPendingHierKnob()` drains + applies. `processPendingHierKnob` resolves
the target via `getKnobContext`, whose result **and cache are keyed on the global
`view`** (`cachedKnobContextsView === view`, L9159). The per-frame drain
(L15451) runs during co-run with `view === OVERTAKE_MODULE`; unwrapped it rebuilds
context under the wrong view and **silently drops the delta** (L9360). So the
drain (and the turn/touch routing) run inside `runCoRunChainEdit(fn)` (L14758),
which swaps `view = coRunView` around `fn`.

## The change (3 edits, fork `src/shadow/shadow_ui.js` only)

Two commits on the fork branch:
- `fad1bfd1` — knob **turn** intercept (in the co-run CC intercept block) +
  per-frame `processPendingHierKnob` drain wrapped in `runCoRunChainEdit`.
- `35bb8ca6` — knob **touch** routing (touch-on peek / touch-off dismiss),
  wrapped, inserted before the tool forward and falling through to it.

`refreshPendingKnobOverlay` is **not** wrapped (not view-keyed — uses
`shadow_get_selected_slot()` + `knobMappings`). No dAVEBOx-side code change — the
routing keys off `coRunChainEditSlot`, which `Edit Slot…` already sets, and every
edit lives under `coRunChainEditSlot >= 0`, so stock / non-co-run Schwung is
untouched (capability-safe).

## The value-popup lifetime — vanilla, left as-is

The popup lingers ~4s after you stop, or until you navigate. **This is vanilla
Schwung**, not ours: `OVERLAY_DURATION_TICKS = 240` (`shared/menu_layout.mjs`);
`showOverlay` re-arms it, `tickOverlay` (runs every frame, incl. co-run)
counts it down and auto-hides at 0. No draw function re-shows it, and
`dismissOverlayOnInput` is unused in shadow_ui — so even the native editor relies
on the same timeout + "next interaction replaces it." Josh chose **vanilla
parity** (no change). If we ever want it snappier, the hook is the touch-off
handler we already route (add `hideOverlay()` on release) or a shorter co-run
duration — both one-liners.

## Deploy state

- Deployed: `~/schwung/src/shadow/shadow_ui.js` → device
  `/data/UserData/schwung/shadow/shadow_ui.js` (checksum
  `2299bed9504ea898ec2dc3d8196462a9`, **matches committed source**). shadow_ui
  **is** the QuickJS runtime, so a clean boot is a stronger syntax-compat signal
  than `node --check` (unreliable per `feedback_quickjs_syntax`).
- **Revert (one line):**
  `ssh root@move.local "cp /data/UserData/schwung/shadow/shadow_ui.js.bak-main /data/UserData/schwung/shadow/shadow_ui.js"`
  then reboot. `.bak-main` is the pre-change (main) build.
- Shim binary (`schwung-shim.so`) **not** touched — no C change. JS-only.

## Remaining to finalize (when ready to ship)

- **Merge** fork branch → fork `main`; merge dAVEBOx branch (notes only) → `main`.
- **Regen** `patches/davebox-local.patch` against fork main
  (`git diff a73ebe89..main -- src/` per current SCHWUNG_PATCHES base).
- **CHANGELOG** `[Unreleased]` (ready-to-paste):
  > **Schwung chain-edit co-run: knobs now drive chain params.** *(Patched-Schwung
  > only — capability-gated.)* In `Edit Slot…` co-run, K1–K8 control the focused
  > chain component's parameters (turn to adjust, touch to peek the value), with
  > the slot-global knob-macro fallback at the chain top level — mirroring the
  > native chain editor.
- **MANUAL** `Edit Slot…` section: note knobs now edit chain params in co-run.
- **Redeploy** `shadow_ui.js` from merged main (already matches; deploy is the
  ship step). No shim rebuild needed.

## Open follow-up (separate)

- **Knob-ring LED feedback in co-run** — dAVEBOx's drawUI early-returns in co-run
  so it isn't painting CC 71-78 LEDs; whether the editor drives them through the
  co-run LED path is unverified. Cosmetic; cf. the Move-native co-run LED handoff
  that just shipped.

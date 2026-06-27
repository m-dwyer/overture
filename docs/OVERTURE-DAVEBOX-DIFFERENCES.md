# Overture vs dAVEBOx — Precise Differences

Overture is a fork of **dAVEBOx** (the Schwung 8-track sequencer tool for Ableton
Move). It keeps all of dAVEBOx's depth and **diverges only where it adopts
Move-native muscle memory**.

This document captures **only what Overture changes** from upstream dAVEBOx. For
everything not listed here — recording, drum lanes, automation lanes, ARP,
Performance Mode, banks, bake/export, persistence — read the full Overture manual
at **[`MANUAL.md`](MANUAL.md)** or the vendored dAVEBOx baseline at
**[`reference/DAVEBOX-MANUAL.md`](reference/DAVEBOX-MANUAL.md)**. Where a control
below says "(unchanged)", it behaves exactly as the dAVEBOx manual describes.

> Status: living document. This document tracks shipped Overture divergences only.

---

## Control map (Overture vs dAVEBOx)

Only the controls Overture changes. Everything else is unchanged — see [`reference/DAVEBOX-MANUAL.md`](reference/DAVEBOX-MANUAL.md).

| Control | dAVEBOx | Overture |
|---|---|---|
| **Side buttons** (Track View) | switch clips on the active track | **select the active track** (1–4; **Shift** = 5–8) |
| **Hold a side button** | — | **reveal that track's 16 clips on the steps** → tap to select |
| **Side-button LEDs** (Track View) | clip status of the active track | **track identity** (active solid, others dim) |
| **Copy / Cut / Delete clip** (Track View) | Copy/Delete + side button | **moved to Session view** (Copy/Delete + clip pad) |
| Clip pads (Session View) | launch/focus clips | occupied pads **launch and select**; empty pads **stop that track and select the empty cell** |
| Side buttons (Session View) | scene launchers | scene launchers *(unchanged)* |
| Shift + jog, Shift + bottom-pad | switch tracks | switch tracks *(retained as fallbacks)* |
| **Jog** (while holding a step) | silently cycled parameter banks (a bug) | **adjusts that step's length**; never changes banks |
| **New melodic step length** | half step | **full step** |
| **New drum step length** | half step | half step *(unchanged)* |
| **Track-View header** | bank name + ad-hoc `>>` hints | bank name + a **bank-position strip** |

---

## Change #1 — Track navigation

### Select a track
In **Track View**, tap a **side button** to make that track active:

| Button (top → bottom) | Track |
|---|---|
| 1st side button | Track 1 |
| 2nd | Track 2 |
| 3rd | Track 3 |
| 4th | Track 4 |

Hold **Shift** while tapping to reach the upper bank — **tracks 5–8**. The active
track's side-button LED is **solid in its track colour**; the other three buttons in
the bank are **dim**. (The OLED still boxes the active track number 1–8.)

This replaces dAVEBOx's "no dedicated track buttons" model. **Shift + jog** and
**Shift + bottom-row pad** still switch tracks and remain as fallbacks.

### See and switch clips — hold a side button
Clips no longer live on the side buttons. To switch the active clip of a track:

1. **Hold** that track's side button (about a quarter-second). The **16 step buttons
   light up as that track's 16 clips** — the active clip is solid in the track
   colour, a playing clip flashes, clips with content are dim, empty clips are dark.
   The held side button flashes white.
2. **Tap a step** to select/launch that clip (same launch/stop/cancel behaviour the
   side buttons used to have — re-tapping the playing clip arms a stop, etc.).
3. **Release** the side button to exit the overlay and return to the step pattern.

A quick tap (released before the overlay appears) just selects the track. While the
transport runs, switching to a track with nothing playing only auto-launches its
focused clip when that clip is empty; clips with notes or drum hits stay off until
explicitly launched.

### Copy / Cut / Delete a clip — in Session view
Per-clip operations move to **Session view**, on the clip pads (where Move keeps clip
management). These already existed in dAVEBOx Session view and are unchanged:

| Gesture (Session view, clip pad) | Effect |
|---|---|
| Copy + pad → Copy + destination pad | Copy clip |
| Shift + Copy + pad → destination | Cut clip |
| Delete + pad | Clear clip (notes) |
| Shift + Delete + pad | Hard reset clip (notes + all params) |

Drum clips copy/cut the same way (all 32 lanes). Scene-row copy/cut and scene launch
on the Session side buttons are **unchanged** (including **Shift + side = launch at
next bar boundary**).

> dAVEBOx's Track-View clip Copy/Delete *via the side buttons* is retired. If you want
> in-Track-View clip duplication later, Move's own gesture is **bare Copy / bare Delete
> on the focused clip** (manual §12.3/§12.4) — a candidate follow-up, not the old
> side-button gesture.

---

## Bank position strip (Track View header)

The Track-View header now shows a compact **bank-position strip** on the right — a
short tick per bank in the jog chain, the **active bank a tall block**. It tells you
*where you are* in the bank chain and *how many banks exist* as you turn the jog
(like Move's Device View). Replaces dAVEBOx's inconsistent `>>` name hints.
Display-only — the jog still cycles banks exactly as before.

---

## Change #3 — Per-step length on the jog (Phase A)

**Hold a step, then turn the jog wheel → adjust that step's length** (Move's "hold
step + wheel = length" gesture). On an empty step the jog does nothing.

This also **fixes a bug**: previously, turning the jog while holding a step *silently
cycled the parameter banks* underneath the Step Edit screen — you'd only discover the
bank had moved (e.g. DELAY → NOTE FX) when you released the step. The jog is now
reserved for step length during a hold and never changes banks.

*Deferred (Phase B):* Move's "hold step + **Volume** = velocity" — the Volume knob
(CC 79) is owned by Move firmware, so routing it to step velocity needs more work.
Velocity stays editable meanwhile on the Step-Edit knobs (K2 drum / K4 melodic).

---

## New-step length defaults

Overture now stamps new steps with defaults that match the sound engine better:

| Track mode | New step default | Why |
|---|---:|---|
| **Melodic / keys** | **1 full step** | Move's keys/pad presets are voiced for sustained notes; half-step defaults sounded clipped. |
| **Drum** | **1/2 step** | Keeps drum hits tight and matches the existing drum workflow. |

This applies only when a step is newly created. Existing clips keep their stored
gate lengths, and explicitly edited step lengths are preserved when you add more
notes to the same step.

Device check, 2026-06-10: drum-mode step sequencing creates 1/2-step notes;
switching that track to keys keeps the existing 1/2-step notes; newly sequenced
keys notes are 1 full step.

You can still override a step's length by holding the step and turning the jog
wheel, or by using the Step Edit length control described in [`reference/DAVEBOX-MANUAL.md`](reference/DAVEBOX-MANUAL.md).

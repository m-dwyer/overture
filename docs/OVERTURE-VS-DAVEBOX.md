# Overture vs dAVEBOx

Overture is a fork of **dAVEBOx** (the Schwung 8-track sequencer for Ableton Move).
It keeps all of dAVEBOx's depth and changes things in just one place: **where Move
players already have muscle memory.** If a control isn't mentioned here, it works
exactly like dAVEBOx.

This page is the friendly overview — "I know dAVEBOx (or Move), what's different?".
For the precise, per-change delta spec see [`MANUAL.md`](MANUAL.md). To learn the whole
instrument Overture-natively, generate the self-contained, screenshot-driven reference
with `pnpm -C web reference:generate` and open `docs/generated/overture-reference.html`.
The upstream dAVEBOx control inventory is vendored as a
diff baseline at [`reference/DAVEBOX-MANUAL.md`](reference/DAVEBOX-MANUAL.md).

## At a glance

| Control | dAVEBOx | Overture |
|---|---|---|
| **Side buttons** (Track View) | Switch clips on the active track | **Select the track** — 1–4, or Shift for 5–8 |
| **Hold a side button** | — | **Reveal that track's 16 clips on the step buttons** → tap to pick one |
| **Side-button LEDs** (Track View) | Clip status | **Track identity** — active is solid, others dim |
| **Copy / Cut / Delete a clip** | In Track View, via side buttons | **In Session View**, on the clip pads |
| **Jog while holding a step** | Silently cycled parameter banks (a bug) | **Adjusts that step's length** — never changes banks |
| **New melodic step length** | Half step | **One full step** |
| **New drum step length** | Half step | Half step *(unchanged)* |
| **Track-View header** | Bank name + ad-hoc `>>` hints | Bank name + a **bank-position strip** |

Session View is unchanged: side buttons still launch scenes, and clip copy/cut/delete
already lived there.

## What changed, and why

**Side buttons select tracks.** On Move, the row of side buttons is where you reach
for a *track*, so in Track View they now do exactly that — tap for tracks 1–4, hold
**Shift** for 5–8. The active button glows in the track colour; the rest stay dim.
(Shift + jog and Shift + bottom-row pad still switch tracks too, as fallbacks.)

**Clips moved off the side buttons.** Since the side buttons became track selectors,
clips moved to a gesture Move users know: **hold a track's side button** and its 16
clips appear on the step buttons — tap one to select or launch it, release to go back.
Per-clip **Copy / Cut / Delete** moved to **Session View**, on the clip pads, where
Move keeps clip management.

**The jog edits step length, not banks.** Hold a step and turn the jog to set **that
step's length** — Move's "hold step + wheel = length" gesture. This also fixes a
dAVEBOx bug where the same motion silently cycled parameter banks underneath you.

**New steps start at a sensible length.** New **melodic** steps now default to a
**full step** (Move's keys presets are voiced for sustained notes; half-step sounded
clipped); **drum** steps stay at a tight **half step**. Existing clips and any length
you set by hand are left alone.

**The header shows where you are.** The Track-View header gained a **bank-position
strip** — a tick per parameter bank with the active one as a tall block — so you can
see how many banks exist and where you are as you turn the jog. It replaces dAVEBOx's
inconsistent `>>` hints and is display-only.

## Future changes

Future divergences should be tracked as fresh issues or design notes. Once behaviour
ships, it belongs in [`MANUAL.md`](MANUAL.md) and the generated reference.

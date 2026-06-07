# Overture — Philosophy

## What Overture is
A **single-install groovebox that augments a running Ableton Move**: one cohesive instrument
where some tracks play Move's **real Ableton engines** (driven live by MIDI injection) and the
rest play **open Schwung/moveforge modules** — under one sequencer, one pad/knob surface, one UI.

## What it is *not*
- **Not standalone.** It needs MoveOriginal *alive* — that's what hosts the Ableton engines we
  drive. (The parked `move-app`/Overture-classic was the opposite: it *killed* MoveOriginal to own
  the hardware, and so could never use Ableton's engines. Different product; see
  `ABLETON-ENGINE-ACCESS.md`.)
- **Not a Schwung replacement.** It's *built on* Schwung and *ships with* it.
- **Not dAVEBOx.** It starts as a fork of dAVEBOx (which already does ~80% of this) and diverges
  into its own product with its own UX + a capability dAVEBOx lacks (see below).

## Core principles

1. **One package; Schwung is the invisible engine.** The user installs *Overture* and sees
   *Overture* — never "install Schwung, then a module, then patch co-run." Schwung (the shim, the
   module host, co-run) is bundled inside and hidden. You don't escape the framework dependency —
   you **embrace it, bundle it, hide it.**

2. **Augment, don't replace.** Move keeps running underneath as the sealed sound engine; Overture
   layers on top (overtake UI + MIDI injection). The whole product rides on the bet that *injecting
   into a running Move is tight and reliable enough to feel native.*

3. **Lean on Move's own UI where it's best.** For editing Ableton sounds (preset browse, device
   params), **co-run** hands the screen + nav to Move's *native* UI inside the tool, rather than
   reimplementing or screen-scraping it. Use the real thing; don't fake it.

4. **Robust seams first; fragile features as best-effort.** Fragility ∝ how deep a feature reaches
   into Move's undocumented internals. The core groove (notes + velocity + poly-AT to the engines,
   plus open-module tracks) rides robust seams. The cherries (live param p-locks, preset switching)
   are best-effort and degrade gracefully. Never let a fragile feature be load-bearing.

5. **Differentiate on UX + one unique capability.** Two things make Overture *Overture*:
   - a **cohesive groovebox UX** (you design it; the Ableton/open seam disappears for the user);
   - **sequenced parameter automation of Move's real engines** — the cable-0 encoder-CC "p-lock
     lane" (our discovery; dAVEBOx edits Move params only *manually* via co-run, doesn't sequence
     them). This is the novel, additive thing.

6. **Minimal divergence from upstreams.** Keep Schwung changes tiny + capability-gated + tracked to
   upstream (and upstream what you can — e.g. co-run). Diverge freely only in the *tool* (your code).
   Every line added to Schwung is a line rebased forever.

## The trade we're accepting
Using Ableton's *real engines, live* is only possible by coexisting with a running Move — so we
take on being a Schwung **integrator/distributor** (bundle + track upstream). In return we get
Ableton's actual sound + the entire Schwung module ecosystem in one instrument. That trade is the
whole reason Overture exists; if it ever stops being worth it, the fallback is the standalone,
open-engines-only path (`move-app`), which owes nothing to Move's firmware but gives up its sound.

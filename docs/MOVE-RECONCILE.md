# Reconciling dAVEBOx ↔ Ableton Move — Overture UX change plan

Derived from a full read of the **Ableton Move manual** (`~/src/move-spike/move-manual.txt`)
and the **dAVEBOx manual** (`overture-ui/MANUAL.md`). This is a *design plan* (intent), not code —
each item becomes `overture-ui/` fork work later. Feeds `UX.md`.

## North star + principles
1. **Overture-native coherence.** Move is an important reference, but not a law.
   Use Move behavior where it improves speed and learnability; diverge where
   Overture can be clearer, more discoverable, or more cohesive.
2. **One meta-gesture.** Move's real secret is *"hold the thing you're editing, turn the obvious
   control"* (hold step → Volume = velocity, Wheel = length; hold track → Volume = level; hold
   pad → Volume = gain). It's *one* mental model that covers most edits. Overture should obey it
   everywhere and stop inventing special-case knob banks where the meta-gesture already works.
3. **Bank, don't dive.** When the surface runs out, prefer a **held modifier** (Shift) over a
   **menu dive**. Menu-diving (jog-through-list) is the last resort, reserved for deep/rare settings.
4. **Edit down for flow.** Fewer modes, fewer 3-key chords, consistent LED hints. More ≠ better.
5. **Lose nothing.** Every existing dAVEBOx capability keeps a home (see the ledger below).

## The core divergence — track navigation (the flagship fix)
On Move, the 4 left buttons **select tracks** (the only way; 1:1 with its 4 tracks). dAVEBOx repurposed
them to **clip control** ("side clip buttons", CC 40–43) and exiled track-switching to Shift+jog /
Shift+bottom-pad / column-tap — its own manual admits *"There are no dedicated track buttons."* That's
the friction you hit (click "Trk 2" → box stays on 1, clip cycles A→B→C→D) and the single biggest break
from Move muscle memory.

**The fix (verified against the code):**
- **4 side buttons → track-select** (tap = tracks 1–4; **Shift+side = 5–8** bank), in **both** views.
  The always-on button strip goes to *tracks* (Move muscle memory); LED shows active track + bank.
- **Clip-flip while editing → hold a track button → its 16 clips appear on the step buttons → tap to
  jump.** This is literally Move's existing *"hold a track button to momentarily view that track"* idiom,
  extended to surface its clips. Random access to **16 clips** (better than today's 4-clip window), stays
  in Track View, costs one held modifier.
- **Performance / arrangement → Session view** (pads = full clip/scene grid, Move-native) is the launch
  surface — unchanged and richer than the old 4-window side launcher.

**What the side buttons actually did, and where each goes** *(code-confirmed: active in **both** views,
operating on the active track at a fixed 4-clip `sceneRow` window — `ui.js` `_onCC_side`)*:
| Side-button job | New home | Net |
|---|---|---|
| Switch edit-clip (Track View) | hold-track → 16 clips on steps | 4-window → **16 direct** |
| Launch clip (Session) | Session pad-grid (track button also selects track) | unchanged / richer |
| Copy / Cut / Clear / Hard-reset clip | Session (already there) or held-track + step + modifier | preserved |
| Always-on per-clip status LEDs | revealed on hold (16 clips) | **trade: always-on-4 → on-demand-16** |

**The one genuine loss:** the **always-on, zero-modifier clip strip**. Those 4 buttons were the only
spare *always-visible* button strip (pads = notes, steps = pattern), so once tracks claim them, clips
become **hold-to-reveal** rather than always-present — flipping the edit-clip mid-pattern now needs a
held track button. Everything else is preserved or improved, and live performance stays on Move's
Session surface, so flow for *making songs and performing* is intact.

## Reconciliation matrix (the big divergences)
Some rows are already shipped in Overture; active priorities are tracked in
`ROADMAP.md`.

| Area | Move-native | dAVEBOx today | Overture current / target |
|---|---|---|---|
| **Clips** | Session pad-grid launches/selects; scene = vertical finger-swipe | Side buttons (both views) **+** Session grid **+** steps-as-scenes | **Shipped:** launch/arrange on the **Session grid**; **edit-clip flip → hold-track → 16 clips on steps**. Scenes: keep steps-as-scene **or** adopt column-swipe (open). |
| **View toggle** | Dedicated **Note/Session** button; **track buttons enter Note** | "Menu / Note-Session" button (tap=toggle, Shift=Global Menu) | Keep it a **pure view toggle**; relabel our shell "Menu" → **Note/Session**. Track buttons select track *and* land in Track View (Move-like). |
| **Menus** | **Shift+Step = 16 named menus** (one button → 16 shortcuts) | Shift+Step shortcuts (**already Move-aligned!**) **+** a jog-dive Global Menu | Keep/extend **Shift+Step** (fast, Move-native). **Demote the jog-dive Global Menu** to deep/rare settings only. Your DRUM-LANE / NOTE-FX confusion was the jog-dive — Move puts those on Shift+Step. |
| **Per-step edit** | hold step → **Volume=vel, Wheel=length, ±=transpose, arrows=nudge, Device-enc=automation, pads=chord** (the meta-gesture) | hold step → **K1–K8 overlay** (Oct/Pit/Leng/Vel/Nudg/Iter/Prob/Ratch) | **Partly shipped:** hold-step + Wheel edits length; K-overlay remains. Target: add velocity, transpose, and nudge shortcuts. |
| **Per-track level** | hold **track + Volume** = track volume | **none** (master only — a documented Limitation) | **Deprioritized:** current probes found no clean route to Move's native faders from inside Overture. |
| **Modifier density** | some 3-key chords (Shift+Mute+track=solo) but mostly 2-key | **many 3-key chords** (Shift+Delete+side, Shift+Mute+lane, Mute+Delete+step…) and a **heavily overloaded Loop** | Trim 3-key chords where a 2-key/contextual gesture suffices; un-overload **Loop** where possible. |
| **Modes** | **3 top-level** (Overview / Note / Session) + 1 toggle | Track / Session **+** Global menu / Loop / Performance / alt-param / Arp-steps | Keep the depth but make **entry/exit consistent + LED-signposted**; fold alt-param/arp-steps behind clearer gestures. |

## Button budget — will we run out?
Short answer: **only for tracks (8 on 4 buttons), and Shift solves it.** Move's surface is richer
than it first looks: 4 track + 16 step + 32 pads + 8 encoders + Volume encoder + clickable Wheel +
Play/Rec/Mute/Capture/Sampling/Delete/Copy/Undo/Loop/Up/Down/Left/Right/Shift/Back/Note-Session.

We stay within budget by **aligning to Move's own assignments first**:
- **Tracks:** 4 side buttons = 1–4, **Shift+side = 5–8** (the one real squeeze).
- **Menus:** stay on **Shift+Step** (16 slots, already there) — no new buttons, no diving.
- **Edits:** the **hold-context + turn-control meta-gesture** needs *zero* new buttons.
- **Deep params** (Iter/Prob/Ratch, automation lanes): the **K1–K8 overlay** when a step is held.
- **Menu-dive** reserved for: deep/rare global settings only.

So: combos where unavoidable (tracks 5–8, deep step params), **menu-diving almost never**. We will
*not* run out catastrophically.

## Flow-state through-line
- **One gesture grammar.** Make "hold what you're editing, turn the obvious control" true
  *everywhere* — that consistency is the flow enabler; special-case banks/overlays break it.
- **No mid-loop mode whiplash.** Track-select and clip-launch shouldn't kick you out of what you're
  doing; held-button *peeks* (Move's idea) let you glance without committing.
- **Predictable feedback.** Contextual LED hints (hold a modifier → the valid targets light up),
  a pinned color language (track identity, active, armed, automating).
- **Kill the two flow-killers:** 3-key chords and jog-dive menus. Both pull you out of the music.

## Preserve-functionality ledger (nothing lost)
Everything keeps a home (full inventory + per-item destination in `DAVEBOX-CHANGES.md`):
- **Edit-clip flip** (side buttons, Track View) → **hold-track → 16 clips on steps**.
- **Clip launch / copy / cut / clear / scene-bake** → **Session View** (already there) or held-track + step + modifier.
- **All Shift+Step menus, step-edit trig params, automation lanes, Performance Mode, Loop View,
  drum lanes/repeats, ARP** → unchanged.
- **Gained:** per-track volume (Move has it, dAVEBOx doesn't); track-level copy/delete (Copy+track).
- **The one real cost:** clips lose their *always-on* button strip → hold-to-reveal (see flagship).

## Current status
- **Shipped:** side buttons select tracks 1-4, Shift + side selects 5-8, clip switching moved to
  hold-side reveal on the steps, and hold-step + jog edits step length.
- **Deprioritized:** hold-track + Volume for Move-native faders, because no clean route was found.
- **Tracked in `ROADMAP.md`:** upstream Schwung migration, Overture UI product seams, Setup Health,
  Move-style step shortcuts, Motion readability, shortcut/menu demotion, LED language, and later
  performance/Conductor research.

## Open decisions (need a call before coding)
- **Track banking:** Shift+side for 5–8, or a dedicated bank toggle with a persistent LED?
- **Scenes:** keep dAVEBOx's steps-as-scene, or adopt Move's **column-swipe**?
- **Clip Copy/Cut/Delete in Track View:** Session-only, or wire onto held-track + step + modifier?
- **Per-step hybrid:** how much of the K-overlay stays vs migrates to the meta-gesture?
- **How aggressively to "edit down"** modes (alt-param, Arp-steps editor) vs preserve power-user depth.

> **Decided:** Track-View clip switch = **hold-track → clips on steps** (Move's hold-to-peek idiom).

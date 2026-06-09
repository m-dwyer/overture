# DAVEBOX-CHANGES — implementation plan (how we modify the tool fork)

The *how* for the *what/why* in `MOVE-RECONCILE.md`. Each change is a `tool/` (schwung-davebox)
fork edit, **prototyped in the emulator + regression-tested (vitest) before committing**. Names like
`_onCC_side` / `S.activeTrack` refer to `tool/ui/ui.js`; LED work is `tool/ui/ui_leds.mjs`.

## Master control map (current → Overture)
Only the controls that change. Everything not listed is unchanged.

| Control | dAVEBOx today | Overture | Change |
|---|---|---|---|
| **Side buttons (CC 40–43)** | clip switch (Track) + clip launch (Session) + clip copy/cut/del | **track-select 1–4**; **Shift+side = 5–8** | #1 |
| **Hold a side button** | (n/a) | **reveal that track's 16 clips on the steps** → tap to jump | #1 |
| **Shift+jog (Track)** | switch track | *(freed)* — spare for a later gesture | #1 |
| **Shift+bottom-pad** | switch track 1–8 | keep as a fallback, or retire | #1 |
| **Step buttons (Track)** | pattern | pattern; **while a side button is held → clips** | #1 |
| **Menu/Note-Session btn** | view toggle + Shift=Global Menu | same; relabel shell "Menu"→**Note/Session** | #2 |
| **Hold step + Wheel** | silently cycled banks (bug) | **= step length** ✅ done | #3 |
| **Hold step + Volume** | (K-overlay only) | **= velocity** (deferred — CC 79 passthrough) | #3 |
| **Hold track + Volume** | (no per-track vol) | **track level** | #4 |
| **Jog-dive Global Menu** | DRUM LANE / NOTE FX etc. | **Shift+Step** shortcuts where Move has them; menu = deep/rare only | #5 |
| **Loop button** | heavily overloaded | un-overload where possible | #6 |

## Change #1 — Track navigation (deep spec)
**Gestures**
- Side button *tap* → `S.activeTrack = idx` (idx 0–3, +4 if Shift held at press). Lands in Track View.
- Side button *hold* (≥~200 ms) → overlay: steps 1–16 show that track's 16 clips (LED = content/active/
  playing); tap a step → set that track's active clip (`tN_launch_clip`); release exits the overlay.
- Shift+side → bank 5–8.

**Code touch points**
- `_onCC_side` (`ui.js` ~8309): **gut the clip behaviour, install track-select.** Reuse the existing
  track-switch path (the Shift+jog / Shift+bottom-pad code already sets `S.activeTrack`, auto-launches
  the focused clip, and re-applies the cable-2 channel remap — lift that into the button handler).
- **Hold detection:** add held-side-button state (press tick + threshold), mirroring the step-hold
  pattern (`heldStep`). On hold → set a `revealClipsTrack` flag.
- **Step handler** (`_onStepButtons` / `_onCC_stepedit`): when `revealClipsTrack >= 0`, a step press
  selects a clip instead of editing the pattern.
- **Clip ops relocation:** the `copyHeld` / `Delete` / scene-bake / merge branches currently in
  `_onCC_side` move to the Session-view clip-pad handlers (most already exist there) and/or onto
  held-track + step + modifier.
- **LEDs** (`ui_leds.mjs`): side buttons now render **track identity + active + bank** (not clip status);
  add the held-track → clips-on-steps LED rendering (content/active/playing per clip).
- **State:** `S.activeTrack` (exists), add `S.trackBank` (0 = 1–4, 1 = 5–8) and `revealClipsTrack`.

**Sequencing (do in this order so nothing breaks mid-flight)**
1. First **relocate** every clip job off the side buttons (launch→Session, copy/cut/del→Session/held-track).
2. Then **repurpose** the side buttons to track-select + the hold-reveal overlay.
3. Then **re-skin** the LEDs.

**Tests (vitest round-trips, `web/tests/integration/`)**
- tap side button 2 → `S.activeTrack` = 1 (assert via OLED box / a state get_param).
- Shift+side 1 → active track = 4 (bank).
- hold side button + tap step 3 → active clip of that track = C (assert `tN_..._steps` / focused clip).
- regression: Session clip launch still works on the pads.

**Risk:** `_onCC_side` is the most overloaded handler (clip launch/switch + copy/cut + scene-bake +
merge placement). The untangle is the bulk of the work — hence step 1 above.

## Changes #2–#6 (touch points; spec each when scheduled)
- **#2 Relabel/align** — `web/src/shell.ts` labels; confirm Note/Session stays a pure toggle.
- **#3 Per-step immediate layer** — **Phase A DONE + device-verified** (merged): hold step + **jog =
  step length** (`_onCC_jog` heldStep branch), which also fixed a real bug (jog silently cycled banks
  under the Step Edit overlay). **Phase B deferred**: hold step + **Volume = velocity** — CC 79 is
  `button_passthrough`-owned by Move firmware (master vol), so it needs a hold-step exception / JS
  volume-takeover; leaning **Shift+jog = velocity** instead. Velocity already editable on the Step-Edit
  knobs (K2 drum / K4 melodic) meanwhile.
- **#4 Per-track volume** — **FULLY MAPPED ON DEVICE (2026-06-10): no clean route, deprioritize.**
  Track CC7 (cable 2) = flat (§4.1.3). CC79 + hold-track (cable 0) moves Move's track-volume overlay
  but **CC79 is the master encoder → bleeds into master**, and needs Move foreground (the overtake shim
  filters the track-button CC while Overture's UI is up), so it can't be driven from inside Overture.
  D-Bus exposes no mixer/volume set method (only a read-only "Track Volume" announcement). The only
  in-Overture path = scale the track in schwung's audio composite (`chain_slots[t].volume`, Link-Audio
  rebuild) — a future build, and schwung's mix gain, not Move's fader. Matches `tool/MANUAL.md:976`
  ("per-track volume not available; adjust on the destination"). Detail: `WEDGE-EXPERIMENT.md`,
  `INJECT-PROBE.md`, memory `move-live-engine-seams`.
- **#5 Demote jog-dive** — move DRUM LANE / NOTE FX / etc. menu pages onto Shift+Step where Move has
  an equivalent; keep the Global Menu for genuinely deep/rare settings.
- **#6 Un-overload Loop** — audit Loop's many meanings; split by clearer context/gesture.

## Function-preservation checklist (the at-risk items)
Authoritative inventory: `tool/MANUAL.md` §15 Cheat Sheet. These are the items the redesign *touches* —
each must keep a home before a change ships:
- [x] side-button clip **switch** → hold-track → steps *(hold side button reveals the 16 clips on the steps)*
- [x] side-button clip **launch** (Session) → Session pads *(Session side buttons unchanged)*
- [x] **Copy+side / Shift+Copy+side** (copy/cut clip) → Session *(Option A: Session clip pads; Track-View branch removed)*
- [x] **Delete+side / Shift+Delete+side** (clear / hard-reset clip) → Session *(Session clip pads)*
- [x] **Copy+side (drum)** = copy 32 lanes → Session *(Session drum clip pads)*
- [x] **Shift+jog / Shift+bottom-pad** (track switch) → side buttons *(side buttons now select tracks; jog/bottom-pad retained as fallbacks)*
- [x] always-on per-clip **status LEDs** → hold-to-reveal *(side-button LEDs now show track identity; clips shown on steps while a side button is held — documented cost)*
- [ ] (#5) DRUM LANE / NOTE FX / scale / swing menu pages → Shift+Step equivalents
- [ ] (#6) every Loop overload → a clear home
Everything else in the Cheat Sheet (Shift+Step shortcuts, step-edit trig params, automation lanes,
Performance Mode, Loop View, drum lanes/repeats, ARP, mutes/solos/snapshots) is **untouched**.

## Two ledgers — the redesign's raw material
**Move features dAVEBOx lacks (candidates to add):**
per-track volume · track-level copy/delete/duplicate · scene = column-swipe · Capture-detects-tempo ·
sampling (out of scope — no audio) · always-armed-capture (dAVEBOx is close).

**dAVEBOx depth beyond Move (must preserve — this is the product):**
8 tracks (vs 4) · per-step trig conditions (Iter/Prob/Ratch) · automation lanes (8, polyrhythmic) ·
Performance Mode mod-grid + snapshots · drum repeats/Euclid/per-lane loops · ARP · scene/clip bake +
live merge + Ableton export · **the p-lock motion lane (Overture's own novel add).**

## Cross-cutting "other things" to do here
1. **Pin the LED & colour language** (`UX.md` flags it "unconfirmed"). #1 changes what the side buttons'
   LEDs mean; do the whole colour map (track identity, active, armed, automating, playing, bank) once,
   in a `LED-LANGUAGE.md`, before re-skinning piecemeal. Move's palette is device-only — capture it on
   hardware when available; the emulator uses an approximation (`web/src/led-palette.ts`).
2. **Mind the integrator tax.** Track-nav is a *big* divergence in `_onCC_side` — it makes rebasing onto
   upstream dAVEBOx releases harder. Keep changes localized and documented (this file) so a rebase is
   tractable; this is the `tool` = THICK-fork tradeoff (see `ARCHITECTURE.md`).
3. **Prototype + A/B in the emulator.** Edit the fork → the emulator hot-reloads the real UI. Keep stock
   dAVEBOx reachable for side-by-side (e.g. a git stash / branch, or a build flag) so "is this actually
   better?" is answerable, not asserted.
4. **A test per change** (vitest round-trip + a golden OLED snapshot of the new surface). The harness +
   gesture helpers exist (`web/tests/integration/harness.ts`).
5. **Finish the deferred melodic step-toggle round-trip** — it's the capstone test and de-risks #1/#3.

## Open decisions (mirror of MOVE-RECONCILE.md)
- Track banking: Shift+side vs a dedicated bank toggle with persistent LED.
- Scenes: steps-as-scene vs Move column-swipe.
- Clip Copy/Cut/Delete in Track View: Session-only vs held-track+step+modifier.
- Per-step hybrid extent; how aggressively to "edit down" modes.

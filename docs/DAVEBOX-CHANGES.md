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
| **Hold step + Volume / Wheel** | (K-overlay only) | **+Volume = velocity, +Wheel = length** (Move meta-gesture) | #3 |
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
- **#3 Per-step immediate layer** — step-hold handler + `host_module_set_param` for vel/length; Volume
  encoder routing (CC 79 is currently dropped — see `ui.js:11353`; needs a hold-step exception).
- **#4 Per-track volume** — hold-track + Volume → route to Move mixer (inject) or Schwung chain level.
- **#5 Demote jog-dive** — move DRUM LANE / NOTE FX / etc. menu pages onto Shift+Step where Move has
  an equivalent; keep the Global Menu for genuinely deep/rare settings.
- **#6 Un-overload Loop** — audit Loop's many meanings; split by clearer context/gesture.

## Function-preservation checklist (the at-risk items)
Authoritative inventory: `tool/MANUAL.md` §15 Cheat Sheet. These are the items the redesign *touches* —
each must keep a home before a change ships:
- [ ] side-button clip **switch** → hold-track → steps
- [ ] side-button clip **launch** (Session) → Session pads
- [ ] **Copy+side / Shift+Copy+side** (copy/cut clip) → Session, or held-track+step+Copy
- [ ] **Delete+side / Shift+Delete+side** (clear / hard-reset clip) → Session, or held-track+step+Delete
- [ ] **Copy+side (drum)** = copy 32 lanes → Session
- [ ] **Shift+jog / Shift+bottom-pad** (track switch) → side buttons (this *is* the change)
- [ ] always-on per-clip **status LEDs** → hold-to-reveal (documented cost)
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

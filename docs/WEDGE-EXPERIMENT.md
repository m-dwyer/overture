# Wedge experiment — the inject spike (ROADMAP "Next up" #1)

**Question.** Inject `CC7` / encoder-CC on a Move-routed channel and **map what the real
engines actually respond to** — which answers **#4 per-track volume** and tells us whether
engine-param sequencing from Overture is worth building *given Move already does p-locks natively*.

## RESULTS (2026-06-10) — #4 closed, no clean route
- **CC7 (cable 2) → flat.** Track CC unsupported (§4.1.3), re-confirmed on device.
- **CC79 + hold-track + touch (cable 0) → moves the track-volume overlay BUT bleeds into master**
  (CC79 *is* the master Volume encoder; master went 100%→low). Also requires Move **foreground** —
  the overtake shim filters the track-button CC while Overture's UI is up — so it can't be driven from
  inside Overture.
- **D-Bus → no mixer/volume set method** (only a read-only ScreenReader "Track Volume" announcement).
- **Verdict:** per-track volume on Move's engine tracks has no clean injection/IPC route. Only
  in-Overture option = scale in schwung's audio composite (`chain_slots[t].volume`, Link-Audio rebuild),
  a future build (schwung's mix gain, not Move's fader). Matches `tool/MANUAL.md:976`. **Deprioritized.**
- **Tooling:** experiments now use the pure-JS **`inject-probe`** (`overture/docs/INJECT-PROBE.md`) —
  no DSP/docker. The DSP `engine-probe` below is kept for history.
- Side-finding: holding a *step* + injected CC79 edits that step's **velocity** (possible #3B path).

---

**Harness.** `engine-probe` v0.2.0 (deployed on `move-em.local`). New **Mode D — TrkCC**: holds C4
on a track channel and flips a *selectable* CC stark `0↔127` every ~0.75 s (cable 2), with an
optional auto-scan that walks CC 0..127. Modes A/B/C unchanged. See
`schwung/src/modules/tools/engine-probe/`.

> Prior result (memory `move-live-engine-seams`, 2026-06-06): track-routed CC74 measured **flat** —
> "MIDI CC unsupported by design" (manual §4.1.3). Mode D lets us confirm that for **CC7 (volume)**
> specifically and scan the rest, since per-track volume is the one CC that might be special-cased.
> If track CC is truly dead, per-track volume rides **Test 3** (cable-0 encoder on a Mixer view).

---

## 0. Setup (once)

1. **Reload the new module.** It was already loaded as v0.1.0 in the running host; opening the tool
   re-dlopens `dsp.so` + re-reads `ui.js`, so just **open Tools → Engine Probe** (Shift+Vol+Step13 /
   Shift+Step13). Confirm v0.2.0 by pressing **Step 4** — the screen should read `Track CC 7 0<->127`.
   If Mode D doesn't appear, **power-cycle the Move** (the `ableton` user has no passwordless sudo, and
   a module install doesn't auto-restart the host — a re-flash-grade restart needs the installer's
   root creds; a power-cycle is the simple path).
2. **Pick a sound that maps modulation.** On Move, select a track whose preset *visibly* responds to
   modulation — a **Drift or Wavetable** preset with a mapped filter/volume (the poly-AT test used a
   pressure-mapped Drift). A flat saw shows nothing and proves nothing.
3. **Audio capture (optional but decisive).** Plug Move into the Mac via USB-C; it enumerates as an
   input named **"Ableton Move"**. Find its index:
   ```sh
   ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -i move
   ```

### Engine Probe controls (v0.2.0)
- **Steps 1–4** → mode: `Expr` / `Encoder` / `SysEx` / **`TrkCC`**
- **Play** → start/stop
- **TrkCC**: **K1** = CC number (hold **Shift** for ±10) · **K2** = track channel (1–16) ·
  **Step 16** = toggle auto-scan
- **Encoder**: K1 = knob CC 71–78 · K2 = cable 0 (hw) ↔ 2 (usb)

---

## Test 1 — CC7 per-track volume (the headline)

1. Engine Probe → **Step 4** (TrkCC). Display shows `Track CC 7 0<->127`.
2. **K2** to set the channel = the track you selected (Ch 1 = track 1, the default).
3. **Play.** The probe holds C4 and slams CC7 between 0 and 127 every ~0.75 s.
4. **Observe.** If CC7 reaches the voice, the note's **loudness pulses** in a square, ~0.75 s on /
   ~0.75 s off. If it's dead-flat (steady note), track-CC7 does **not** control Move volume — the
   §4.1.3 verdict holds and per-track volume must come from **Test 3**.
5. *(Decisive)* Capture ~10 s and check the RMS square:
   ```sh
   ffmpeg -f avfoundation -i ":N" -t 10 -ac 2 -ar 44100 /tmp/cc7.wav   # N = Move index
   ./schwung/scripts/analyze_wavs.py /tmp/cc7.wav                       # RMS / centroid
   ```
   A ~0.743 s half-period RMS swing = CC7 works; flat = no.

## Test 2 — Scan the CC space (map what *anything* responds to)

1. TrkCC mode, **K1** to pick a starting CC (or leave at 7), then **Step 16** → `SCAN`.
2. **Play.** The DSP walks CC 0..127, ~3 s per CC (two full A/B cycles). The OLED shows the **live
   CC number** — film/note it so you can map time → CC offline.
3. Capture the whole sweep (128 CCs × ~3 s ≈ 6.5 min) in one file:
   ```sh
   ffmpeg -f avfoundation -i ":N" -t 400 -ac 2 -ar 44100 /tmp/ccscan.wav
   ```
4. Offline, find which ~3 s windows show an RMS/centroid square (each window's CC = `start_cc +
   floor(t / 3.0)`). Any hit beyond poly-AT's known channels is a new live-control seam.
   - To **hand-scan** instead: don't enable SCAN; while running, turn **K1** to step CCs and listen.

## Test 3 — Per-track volume via the cable-0 encoder (the likely-real path)

Move's per-track volume lives in the track **mixer**, reachable by the *proven* positional p-lock
path (cable-0 encoder CC), not by track CC.

1. On Move, navigate to a view where a **knob maps to the track's volume / a mixer level** (the
   per-track Volume/Mixer page). Note which physical knob (1–8) holds volume.
2. Engine Probe → **Step 2** (Encoder). **K1** → set knob CC to match that knob (71=K1 … 78=K8).
   Leave **cable 0** (K2 toggles 0↔2 if needed).
3. **Play**, then **Back** (suspend_keeps_js keeps it injecting) so Move's view is showing.
4. **Observe** the on-screen volume value + the audio sweep up/down hands-off. If it travels, that's
   how Overture sets per-track volume: navigate-to-page + cable-0 knob CC (same mechanism co-run
   already uses for device-page targeting).

---

## Recording the result
Update memory `move-live-engine-seams` and `DAVEBOX-CHANGES.md` #4 with:
- CC7 → volume? (Test 1) ·  any other live CC? (Test 2) ·  encoder-on-mixer → volume? (Test 3)
- The verdict on **#4 per-track volume** (which of Schwung-chain-level vs Move-mixer-inject to wire),
  and the strategic read on whether engine-param sequencing is worth building vs Move's native p-locks
  + co-run.

# Harness Evolution — fidelity roadmap + manual generation (spike)

**Status:** spike / design note, not committed work. Captures where the headless
harness can go so we can eventually verify (almost) everything off-device and
auto-generate a usage manual — plus the one wall we will never get past.

**Two goals:**
1. **Raise fidelity** so a green suite means more — close the gaps in
   [`COVERAGE-GAP-MAP.md`](COVERAGE-GAP-MAP.md) (coalescing, QuickJS, real
   set_param delivery, the real save→file→load path).
2. **Generate the manual** — drive the real UI to documented states and capture
   the OLED automatically (proven by the spike in `web/tests/manual-shots.spec.ts`).

---

## The hard ceiling (state it first)

Overture is a Schwung **tool** module. Tracks 1–4 drive **Move-native synth
engines that live in the Ableton Move firmware** (proprietary). No headless
harness — and no port — can run that firmware. So we can never, off-device:

- produce audio for tracks 1–4, or
- show the **Move sound editor** those tracks hand off to.

This is independently confirmed by **[iSchwung](https://github.com/hashFactory/iSchwung)**
(a real iOS port of Schwung): its own notes say *"davebox track routing: tracks
1–4 assume native Move hardware (absent); only tracks 5–8 produce sound through
Schwung chains."* Same wall, hit by someone who got much further than a test
harness. We design **around** this: tracks 1–4 are observable only as the MIDI /
CC p-locks we emit *toward* them, and the manual uses device photos (or "on
hardware" notes) for anything Move-native.

Everything below is about closing the *other* gaps — the ones that are real
engineering, not firmware.

---

## Where the harness is today (Tier 0)

| Piece | Today | Real or stubbed |
|---|---|---|
| Tool JS (`ui.js` + `ui/*.mjs`) | runs under **V8** (Node/vitest) | real code, wrong engine |
| seq8 DSP | compiled to **wasm** (emscripten) | real C logic, in-memory state only |
| Schwung host | `web/src/host/emulator.ts` **shims** (`host_module_set_param`, files, co-run) | **stubbed** |
| Hardware (OLED/LED/pad/encoder) | recorder sinks / browser canvas | stubbed (by design) |

Strengths: fast, broad, drives the *real* tool logic. Blind spots (per the gap
map): set_param **coalescing**, **QuickJS** runtime, real host **delivery
timing**, the real **save→file→load** path, audio/RT/94 Hz.

---

## The fidelity ladder

### Tier 1 — make the existing stub *adversarial* (cheap, high value)

The emulator shim currently models a perfect host. Make it model the device's
*nasty* behaviors so optimistic tests start failing where the device would:

- **Coalescing** — `host_module_set_param` should keep only the **last** value
  per key within a simulated buffer/tick window, mirroring "only the last
  set_param per audio buffer reaches DSP." This is the **#1 gap** and a pure
  shim change — no new runtime.
- **Silent-drop of new global keys** — the host drops *new* non-`tN_` global
  set_param keys; the shim should too (catches the exact class in
  `overture-ui/CLAUDE.md` → Critical constraints).
- **`get_param` from on-MIDI returns null** — model it, so tests that read
  engine truth in the wrong context fail headlessly instead of on device.

Effort: small. Risk: low. Payoff: turns the cheapest tier into a real bug-catcher
and would have flagged the metronome-class bug.

### Tier 2 — host-in-the-loop (the iSchwung model)

Run the **real Schwung host core** instead of stubs. iSchwung proves this builds
and runs off-device:

- It clones Schwung at a pinned commit (`SCHWUNG_PIN`), builds
  **QuickJS + unmodified `shadow_ui.c` / `js_display.c` + the plugin API + the
  SHM protocol** into `libschwungcore.a`, and replaces only the Move-firmware
  shim (CoreAudio for audio, SwiftUI for the control surface). `/data/UserData`
  is macro-remapped via a force-include header.

Our analogue, headless:
- **Pin upstream Schwung** (we already vendor it as a submodule) and build its
  host core for the **host OS** (Linux/macOS), not aarch64.
- **Load the real `seq8` DSP** via the real `plugin_api_v2` (`create_instance` /
  `on_midi` / `set_param` / `get_param` / `render_block`) — a host-native build
  of the single-TU `seq8.c`, not wasm.
- **Drive `ui.js` under real QuickJS**, through the real host's set_param/SHM
  delivery path.
- **Replace only hardware I/O** with our existing recorder sinks + a test driver
  (the same gesture vocabulary), and remap `/data/UserData` to a temp dir.

What it closes: **QuickJS divergence, real set_param delivery + coalescing, the
real DSP (state in `seq8-state.json`, so the real save→file→load path), co-run
APIs** — i.e. most of the "honest caveats" in the gap map.

Effort: large (build system, the pin, the plugin-API harness). De-risk with a
tiny PoC first: a C harness that `dlopen`s a host-native `seq8.so`, sends one
`set_param`, reads one `get_param`. If that works, the rest is plumbing.

### Tier ceiling — Move firmware

Unreachable (see above). Covered by [`DEVICE-SMOKE.md`](DEVICE-SMOKE.md).

---

## Gaps → which tier closes them

| Gap (from gap map) | Tier 1 | Tier 2 | Device-only |
|---|---|---|---|
| set_param coalescing | ✅ (modeled) | ✅ (real) | |
| silent-drop of new globals | ✅ | ✅ | |
| QuickJS vs V8 runtime | | ✅ | |
| real save→file→load roundtrip | | ✅ | |
| co-run / SHM delivery | | ✅ | |
| real audio / voices / metronome | | | ✅ |
| LED/OLED/palette/pad hardware, 94 Hz, RT | | | ✅ |
| tracks 1–4 audio / Move sound editor | | | ✅ (firmware) |

Most of the scary middle is **Tier 2**; the cheapest scary one (coalescing) is
**Tier 1**.

---

## Manual generation track

The spike (`web/tests/manual-shots.spec.ts`) already drives the real UI in the
browser emulator via `OVT.midiIn` (the harness gesture vocabulary) and captures
`#oled` to PNG. To make it a manual system:

- **Figure catalog** — data-driven `(name, captionsFromRecorder, gestureScript)`
  → OLED PNG. Gesture scripts port verbatim from the integration tests.
- **Deterministic posing** — the one real gap: posing deep/bank-specific states
  (e.g. the CC PARAM bank) needs either the real bank-select gestures mapped, or
  a tiny `OVT` test hook (`OVT.setBank`/`setTrack`) for docs only. Recommend the
  hook — it keeps figures stable and is doc-only.
- **Captions / alt-text** — the recorder's `print()` text is the OLED's literal
  text; reuse it for figure captions and accessible alt-text.
- **Stay in sync** — figures render from the real `ui.js`, so a `mise run figures`
  task regenerates them; they can't drift from the UI.
- **The manual's ceiling** — anything Move-native (tracks 1–4 sound editor) can't
  be screenshotted; use device photos or "on hardware" callouts there.

A full manual = generated OLED figures + the documented gesture vocabulary +
[`DEVICE-SMOKE.md`](DEVICE-SMOKE.md) for the device-only behaviors.

---

## Recommended sequencing

1. **Tier 1 adversarial shims** (coalescing first) — small, closes the #1 gap,
   independent of everything else. Do this next.
2. **Finish the headless-able coverage** the current tier *can* reach — tick
   pipeline, drum/perform, p-lock record-while-playing — now that Tier 1 makes
   those tests meaningful.
3. **Tier 2 PoC** — the `dlopen` + plugin-API spike. Decide go/no-go on
   host-in-the-loop from that one result.
4. **Manual figure system** — parallel, low-risk, builds on the screenshot spike.
5. **Accept the firmware ceiling** — device photos + `DEVICE-SMOKE.md`.

## Open decisions

- Tier 2 worth it, or is Tier 1 + the device-smoke pass "enough"? (Tier 2 is the
  only way to make `set_param`/QuickJS/persistence genuinely trustworthy
  off-device, but it's real build work.)
- Manual posing: real gestures vs a doc-only `OVT` hook.
- Where the manual + figures live (alongside `overture-ui/MANUAL.md`, or a new
  `docs/manual/`).
</content>

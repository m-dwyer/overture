# Crash investigation — Move "crash" during normal operation (2026-05-23)

## Symptom
User reported Move "crashed during normal operation" — perceived as whole device
froze/rebooted. User is NOT certain what they were doing: possibly changing step velocity
while holding a pad, possibly pressing Back to suspend, possibly entering co-run. Happened
unexpectedly; no reliable repro.

## Corrected timeline (this matters — earlier analysis was overconfident)
Boot ~14:57 UTC. Now 15:49 UTC. Device uptime continuous **52 min**.
- 15:15:35 — `seq8.log` last write, then **silent for 34+ min** (module hung or exited here).
- 15:17:42 — `sched: RT throttling activated` (dmesg), **~2 min AFTER log went silent**.
- No kernel reboot (uptime continuous), no panic/oom/kill/segfault/watchdog-fired in dmesg.

## What the evidence actually supports
- **App/process-level event, NOT a kernel panic.** Uptime is continuous across the incident;
  the user's "rebooted" was most likely the Move app/Schwung process restarting.
- **The module HUNG at 15:15:35** (stopped logging mid-operation), and ~2 min later the thread
  it was occupying tripped RT throttling. **The throttle is a downstream symptom of the hang,
  not its cause.** This RULES OUT the earlier "I/O storm → throttle → crash" chain — the
  ordering is backwards for that.
- The genuine end of the log is the `Z4` clip-rebuild flood (clip t1/c0, step-velocity
  triangle 43↔60) then 2 `transport: stop`. The flood shows a step/velocity edit burst was
  happening shortly before silence. The 2 trailing stops are ambiguous (suspend emits a stop,
  but so does any user stop, and there are hundreds elsewhere) — do not over-weight them.

## Strongest hypothesis (medium confidence): silently-swallowed JS exception at suspend edge
A JS throw inside the suspend tick handler is, in QuickJS, propagated **unlogged** and the
module silently "exits"/stops (documented lesson: [[project_melodic_drum_conversion_crash]]).
That fits silence-then-throttle: JS dies → audio thread keeps spinning without a consumer →
CPU climbs → throttle fires 2 min later. This also matches the parked
`notes/suspend-crash-rare-edge.md` (a real non-reproducing crash at the Move home-button
suspend edge), whose #1 candidate is `JSON.stringify` on a sidecar field that's undefined/
unserializable in a rare state. The log shows a precondition the parked note never tested:
**a clip stuffed with 16 same-pitch notes** + possible mid-velocity-edit state.

Alternatives, lower:
- **Co-run handoff (Edit Slot...)** — has a cable-race SIGABRT history, but SIGABRT terminates
  the process rather than leaving it spinning; less consistent with silence-then-throttle.
  Worth checking only if co-run entry can overlap a Back/home gesture.
- **Clip-rebuild flood hitting a degenerate state** — loops in `clip_migrate_to_notes` /
  `clip_insert_note` are bounded; no specific evidence of an infinite loop. Lowest.

## Separate latent bug (NOT proven to be this crash — file independently)
`Z4 INSERT` debug probe in `clip_insert_note` (dsp/seq8.c L5010-5018) does a synchronous
`seq8_ilog` file write on **every** insert into clip t1/c0. Step edits rebuild notes[] via
`clip_migrate_to_notes` (called from ~55 set_param handlers, on the audio thread), so a knob
sweep = many rebuilds × 16 file writes. This is shipped debug instrumentation (committed
2026-05-19 `2a00073`, never removed) and should not be in a release build. **Do NOT delete it
outright** — it's the only marker we currently have that "something is off" with t1/c0.
Prefer rate-limiting it or gating behind a runtime/compile debug flag, preserving the signal
while removing the I/O storm. (Other hot-path logs: `WINDOW SNAP` L7658/L7671 self-correct;
`repeat-invariant` L4119 already rate-limited.)

## Recommended next steps (instrument, don't claim a fix without a repro)
1. **Add the diagnostic the parked note already asked for:** wrap the suspend tick handler in
   try/catch and write the exception message to a sidecar file via `host_write_file` (NOT
   `host_module_set_param('debug_log', ...)` — documented unreliable). If it recurs, we get the
   JS error. Matches the "wrap tick in try/catch + host_write_file" lesson.
2. **Attempt repro with the missing precondition:** clip filled with 16 same-pitch notes (as
   the log shows), perf mode possibly active, then Move home-button suspend repeatedly.
3. **Check** whether co-run entry can be reached via a Back/home gesture overlapping suspend.
4. **Separately**, gate/rate-limit the `Z4` probe (and audit for other shipped probes) — pre-
   release cleanup, tracked apart from the crash.

## STATUS — diagnostic deployed 2026-05-23 (uncommitted, working tree)
Added `captureError(where, e)` helper in `ui/ui.js` (before `globalThis.init`) and wrapped the
three host entry points — `tick`, `onMidiMessageInternal`, `onMidiMessageExternal` — in
try/catch (thin-wrapper rename: `_tickImpl` / `_onMidiInternalImpl` / `_onMidiExternalImpl`).
On an otherwise-silent QuickJS exception it appends `[tick sv loop lock susp] where: msg +
stack` to **`/data/UserData/schwung/seq8-jserr.log`**, deduped by (where|message) so it writes
once (no I/O storm), and **swallows** the error so the module survives instead of hanging.
This covers all three candidate triggers (suspend in tick; velocity/co-run in onMidi). Throws
inside `saveState`/`writeSidecar` are caught here too (called from those entry points).
Bundled + installed + Move restarted. NOT committed. **Remove after the crash is pinned.**

Next: if it recurs, `scp ableton@move.local:/data/UserData/schwung/seq8-jserr.log` for the
error. Also attempt repro: clip filled with 16 same-pitch notes → Move home-button suspend
repeatedly (transport playing / perf mode active).

## Key correction / lesson
Don't treat an accumulated log's histogram as a single-session signal, and check event
ORDERING against dmesg uptime before assigning causation. The RT-throttle was downstream of
the hang, not the trigger. The Z4 I/O probe is a real latent issue but is NOT established as
the cause of this freeze.

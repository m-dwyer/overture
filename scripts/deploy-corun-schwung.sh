#!/usr/bin/env bash
# Deploy the co-run-patched Schwung host (the v0.9.17+corun "bridge") to the Move.
#
# This is a TARGETED 3-file swap — shim + shadow_ui + shadow_ui.js — that overlays
# co-run onto an existing *stock* Schwung WITHOUT reinstalling. It preserves your
# Sets, all modules (incl. Overture), and every other Schwung binary. Co-run's
# entire footprint lives in those 3 files (shadow_constants.h is a header compiled
# into the shim + shadow_ui, so no 4th file).
#
# A VERSION GUARD refuses to deploy onto a Schwung whose host/version.txt differs
# from the bridge build's base — a mismatched shim/shadow_ui risks silent SHM
# corruption (the other v0.9.x binaries read the same shared memory).
#
# Bridge until upstream PR #94 lands; then this is unnecessary. Source of truth:
# the `corun` branch on m-dwyer/schwung (our snapshot). See the corun-on-v0917
# memory. $SCHWUNG_FORK_DIR is just the build workspace; `mise run corun-build`
# clones the snapshot there if absent.
set -euo pipefail

FORK="${SCHWUNG_FORK_DIR:-$HOME/src/move-spike/legsmechanical-schwung}"
HOST="${MOVE_HOST:-move.local}"
B="$FORK/build"
SD="/data/UserData/schwung"
ROOT="root@${HOST}"
ABLE="ableton@${HOST}"

# --- preflight: build present + actually carries co-run -----------------------
[ -f "$B/shadow/shadow_ui" ] || { echo "ERROR: no build at $B — run 'mise run corun-build' first."; exit 1; }
# NB: use grep -c (reads all input), not grep -q — with `set -o pipefail`, grep -q
# closes the pipe early, strings gets SIGPIPE, and the pipeline falsely "fails".
if [ "$(strings "$B/shadow/shadow_ui" | grep -c shadow_corun_begin)" -eq 0 ]; then
  echo "ERROR: built shadow_ui has no co-run symbol — is $FORK on the 'corun' branch?"; exit 1
fi

# --- VERSION GUARD: bridge base must match the device's Schwung version --------
BUILD_VER="$(tr -d '[:space:]' < "$B/host/version.txt")"
DEV_VER="$(ssh -o ConnectTimeout=8 "$ABLE" "cat $SD/host/version.txt" 2>/dev/null | tr -d '[:space:]')"
[ -n "$DEV_VER" ] || { echo "ERROR: could not read device Schwung version (ssh $ABLE)."; exit 1; }
if [ "$BUILD_VER" != "$DEV_VER" ]; then
  echo "ERROR: VERSION MISMATCH — device Schwung is v$DEV_VER, bridge build is v$BUILD_VER."
  echo "       A mismatched shim/shadow_ui risks silent SHM corruption; refusing to deploy."
  echo "       Rebuild the bridge against the device's version first, e.g.:"
  echo "         cd $FORK && git fetch upstream --tags \\"
  echo "           && git rebase --onto v$DEV_VER <old-base> corun \\"
  echo "           && mise run corun-build"
  exit 1
fi
echo "Version OK (device + bridge both v$DEV_VER). Deploying co-run -> $HOST ..."

# --- one-time backup of the STOCK binaries (never clobber an existing backup) --
ssh "$ROOT" "cd $SD && \
  [ -f schwung-shim.so.pre-corun ]     || cp -a schwung-shim.so       schwung-shim.so.pre-corun; \
  [ -f shadow/shadow_ui.pre-corun ]    || cp -a shadow/shadow_ui      shadow/shadow_ui.pre-corun; \
  [ -f shadow/shadow_ui.js.pre-corun ] || cp -a shadow/shadow_ui.js   shadow/shadow_ui.js.pre-corun; \
  echo '  stock binaries backed up as *.pre-corun (kept if already present)'"

# --- 1. shim (atomic replace via rename on the data partition, then setuid) ----
scp -q "$B/schwung-shim.so" "$ROOT:$SD/schwung-shim.so.new"
ssh "$ROOT" "mv $SD/schwung-shim.so.new $SD/schwung-shim.so && chmod u+s $SD/schwung-shim.so"

# --- 2. shadow_ui + .js (kill the running shadow_ui first — it mmaps the inode;
#        stage on the DATA partition, NEVER /tmp: the root FS is ~full) ---------
ssh "$ROOT" "killall -9 shadow_ui 2>/dev/null; true"
scp -q "$B/shadow/shadow_ui"    "$ROOT:$SD/shadow/shadow_ui.new"
scp -q "$B/shadow/shadow_ui.js" "$ROOT:$SD/shadow/shadow_ui.js.new"
ssh "$ROOT" "mv $SD/shadow/shadow_ui.new $SD/shadow/shadow_ui && chmod +x $SD/shadow/shadow_ui && \
             mv $SD/shadow/shadow_ui.js.new $SD/shadow/shadow_ui.js"

# --- 3. restart the stack (Schwung's own helper, as ableton, detached) ---------
echo "Restarting Move stack..."
ssh "$ABLE" "sh $SD/restart-move.sh" >/dev/null 2>&1 || true
echo -n "  waiting for shadow_ui to respawn"
until ssh -o ConnectTimeout=5 "$ABLE" 'pgrep -x shadow_ui >/dev/null' 2>/dev/null; do echo -n .; sleep 3; done
echo

# --- 4. verify co-run landed --------------------------------------------------
N="$(ssh "$ABLE" "strings $SD/shadow/shadow_ui | grep -c shadow_corun_begin" 2>/dev/null || echo 0)"
if [ "$N" = "3" ]; then
  echo "Done — co-run live on $HOST. Overture -> Shift+Note/Session -> 'Edit Synth...' on a Move-routed track."
else
  echo "WARNING: co-run symbol count = $N (expected 3) — check the deploy."
fi

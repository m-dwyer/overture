#!/usr/bin/env bash
# Revert the co-run bridge — restore the stock Schwung binaries from the
# *.pre-corun backups taken by deploy-corun-schwung.sh, then restart.
#
# CAUTION: the backups are the version they were captured at (e.g. v0.9.17). If
# you've since web-updated Schwung to a newer version, DON'T run this — it would
# downgrade you. After a web update, just `rm /data/UserData/schwung/*.pre-corun
# /data/UserData/schwung/shadow/*.pre-corun` to clean up the stale backups.
set -euo pipefail

HOST="${MOVE_HOST:-move.local}"
SD="/data/UserData/schwung"
ROOT="root@${HOST}"
ABLE="ableton@${HOST}"

ssh "$ROOT" "cd $SD && \
  [ -f schwung-shim.so.pre-corun ] || { echo 'ERROR: no *.pre-corun backup found — nothing to revert.'; exit 1; }; \
  cp -a schwung-shim.so.pre-corun schwung-shim.so && chmod u+s schwung-shim.so; \
  killall -9 shadow_ui 2>/dev/null; true; \
  cp -a shadow/shadow_ui.pre-corun    shadow/shadow_ui    && chmod +x shadow/shadow_ui; \
  cp -a shadow/shadow_ui.js.pre-corun shadow/shadow_ui.js; \
  echo '  restored stock binaries from *.pre-corun'"

echo "Restarting Move stack..."
ssh "$ABLE" "sh $SD/restart-move.sh" >/dev/null 2>&1 || true
echo "Reverted to stock Schwung. (Backups left in place; rm *.pre-corun to clean up.)"

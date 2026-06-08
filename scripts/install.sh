#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MODULE_ID="overture"
MOVE_HOST="${MOVE_HOST:-move.local}"
MOVE_USER="${MOVE_USER:-ableton}"
SCHWUNG_DIR="${SCHWUNG_DIR:-/data/UserData/schwung}"
DO_RESTART=1

while [ $# -gt 0 ]; do
    case "$1" in
        --host)
            [ -z "$2" ] && { echo "Error: --host requires a value"; exit 1; }
            MOVE_HOST="$2"
            shift 2
            ;;
        --no-restart)
            DO_RESTART=0
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--host <hostname>] [--no-restart]"
            echo "  --host <hostname>   Override target (default: move.local or \$MOVE_HOST)"
            echo "  --no-restart        Copy files only; don't restart the Move stack (JS/DSP won't reload)"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

INSTALL_DIR="${SCHWUNG_DIR}/modules/tools/${MODULE_ID}"

if [ ! -f "dist/${MODULE_ID}/dsp.so" ]; then
    echo "Error: Build not found. Run ./scripts/build.sh first."
    exit 1
fi

echo "Checking connection to ${MOVE_HOST}..."
if ! ssh -o ConnectTimeout=5 "${MOVE_USER}@${MOVE_HOST}" true 2>/dev/null; then
    echo "Error: Cannot reach ${MOVE_HOST}"
    echo "Make sure your Move is on and on the same network."
    exit 1
fi
echo "Connected."

echo "Installing ${MODULE_ID} to ${INSTALL_DIR} on ${MOVE_HOST}..."
ssh "${MOVE_USER}@${MOVE_HOST}" "mkdir -p ${INSTALL_DIR}"
scp -r "dist/${MODULE_ID}"/* "${MOVE_USER}@${MOVE_HOST}:${INSTALL_DIR}/"

echo ""
echo "Installation complete: ${INSTALL_DIR}"

if [ "$DO_RESTART" = "1" ]; then
    # Reload the whole Move stack so shadow_ui picks up the new ui.js (and the DSP
    # .so) from disk. Move runs sysvinit (no systemd/systemctl), so we use the
    # Schwung-installed restart helper rather than poking the init system: it runs
    # as the ableton user (no root needed), setsid-detaches, closes the inherited
    # SPI fd, kills the full stack (incl. MoveLauncher), frees /dev/ablspi0.0, and
    # relaunches /opt/move/Move fresh — which respawns shadow_ui (new PID → reloads
    # ui.js). Same mechanism as ~/src/moveforge/scripts/restart-move.sh. The scp
    # above is complete, so nothing races the copy.
    RESTART_HELPER="${SCHWUNG_DIR}/restart-move.sh"
    echo "Reloading Move + Schwung stack via ${RESTART_HELPER}..."
    if ssh -o ConnectTimeout=5 "${MOVE_USER}@${MOVE_HOST}" "test -x '${RESTART_HELPER}'" 2>/dev/null; then
        ssh -o ConnectTimeout=5 "${MOVE_USER}@${MOVE_HOST}" "sh '${RESTART_HELPER}'" 2>/dev/null || true
        echo "Reloaded. Give it ~15s to come back up, then open ${MODULE_ID} from the Schwung Tools menu."
    else
        echo "WARNING: ${RESTART_HELPER} not found/executable on ${MOVE_HOST} (is Schwung installed?)."
        echo "  Restart manually: ssh ${MOVE_USER}@${MOVE_HOST} \"sh ${RESTART_HELPER}\"  (or power-cycle the Move)."
    fi
else
    echo "Skipped restart (--no-restart). JS/DSP will not reload until the stack restarts."
fi

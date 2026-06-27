#!/usr/bin/env bash
# Build and install the active Overture tool package to a Move via Schwung.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$TOOL_DIR/.." && pwd)"

MODULE_ID="${MODULE_ID:-overture}"
TARBALL="$TOOL_DIR/dist/${MODULE_ID}-module.tar.gz"
SCHWUNG_INSTALL="${SCHWUNG_INSTALL_SCRIPT:-$REPO_DIR/schwung/scripts/install.sh}"
MOVE_HOST="${MOVE_HOST:-move.local}"

"$SCRIPT_DIR/build.sh"

[ -f "$SCHWUNG_INSTALL" ] || {
    echo "ERROR: missing Schwung installer: $SCHWUNG_INSTALL" >&2
    exit 1
}
[ -f "$TARBALL" ] || {
    echo "ERROR: missing tool tarball after build: $TARBALL" >&2
    exit 1
}

bash "$SCHWUNG_INSTALL" install-module "$TARBALL" "--host=$MOVE_HOST"

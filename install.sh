#!/usr/bin/env bash
# Overture one-shot installer (STUB — see docs/ARCHITECTURE.md).
# Will: build patched shim + shadow_ui (schwung/ submodule, co-run baked in),
#       build the tool (overture-ui/ submodule), bundle modules/, deploy all to MOVE_HOST.
set -euo pipefail
: "${MOVE_HOST:=move-em.local}"
echo "Overture installer not implemented yet. Target: $MOVE_HOST"
echo "Build order is tool-first; see docs/ARCHITECTURE.md."

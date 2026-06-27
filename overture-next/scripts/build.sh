#!/usr/bin/env bash
# Build the active Overture Schwung tool package.
#
# Overture is currently a pure tool UI: no dsp.so or WASM artifact is built here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$TOOL_DIR/.." && pwd)"

MODULE_ID="${MODULE_ID:-overture}"
ENTRY="$TOOL_DIR/ui/ui.js"
DIST_DIR="$TOOL_DIR/dist/$MODULE_ID"
OUT="$DIST_DIR/ui.js"
TARBALL="$TOOL_DIR/dist/${MODULE_ID}-module.tar.gz"

find_esbuild() {
    if [ -n "${ESBUILD:-}" ]; then
        printf '%s\n' "$ESBUILD"
    elif [ -x "$TOOL_DIR/node_modules/.bin/esbuild" ]; then
        printf '%s\n' "$TOOL_DIR/node_modules/.bin/esbuild"
    elif [ -x "$REPO_DIR/web/node_modules/.bin/esbuild" ]; then
        printf '%s\n' "$REPO_DIR/web/node_modules/.bin/esbuild"
    elif command -v esbuild >/dev/null 2>&1; then
        command -v esbuild
    else
        return 1
    fi
}

ESBUILD_BIN="$(find_esbuild)" || {
    echo "ERROR: esbuild not found. Run pnpm install, or set ESBUILD=/path/to/esbuild." >&2
    exit 1
}

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cp "$TOOL_DIR/module.json" "$DIST_DIR/module.json"

echo "Bundling $ENTRY -> $OUT"
"$ESBUILD_BIN" "$ENTRY" \
    --bundle \
    --format=esm \
    --platform=neutral \
    --target=es2020 \
    --legal-comments=none \
    --outfile="$OUT"
echo "Bundle: $(wc -c < "$OUT") bytes"

QJS="${QJS_BIN:-}"
if [ -z "$QJS" ]; then
    CAND="$REPO_DIR/schwung/libs/quickjs/quickjs-2025-04-26/qjs"
    if [ -x "$CAND" ]; then
        QJS="$CAND"
    elif command -v qjs >/dev/null 2>&1; then
        QJS="$(command -v qjs)"
    fi
fi

if [ -n "$QJS" ]; then
    GATE_OUT="$("$QJS" -m "$OUT" 2>&1 || true)"
    if printf '%s' "$GATE_OUT" | grep -q "SyntaxError"; then
        echo "QuickJS parse gate FAILED:" >&2
        printf '%s\n' "$GATE_OUT" >&2
        exit 1
    fi
    echo "QuickJS parse gate: OK"
else
    echo "WARN: qjs not found; skipping QuickJS parse gate. Set QJS_BIN to enable it."
fi

tar -czf "$TARBALL" -C "$TOOL_DIR/dist" "$MODULE_ID/"
ls -lh "$TARBALL"
echo "Build complete: $DIST_DIR/"

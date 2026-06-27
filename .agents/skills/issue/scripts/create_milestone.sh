#!/usr/bin/env bash
# Create a GitHub milestone for this repo (idempotent on title).
#
# Usage:
#   scripts/create_milestone.sh --title "Sequencer v2" [--description "..."] [--due 2026-09-01] [--dry-run]
#
# A milestone groups issues for a release or phase; it is independent of board
# Status. Attach issues with create_issue.sh --milestone "<title>".

set -euo pipefail

TITLE=""
DESC=""
DUE=""
DRY_RUN=0

usage() { sed -n '2,10p' "$0" >&2; }
die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --title|-t)       [ $# -ge 2 ] || die "--title requires a value"; TITLE="$2"; shift 2 ;;
        --description|-d) [ $# -ge 2 ] || die "--description requires a value"; DESC="$2"; shift 2 ;;
        --due)            [ $# -ge 2 ] || die "--due requires a value"; DUE="$2"; shift 2 ;;
        --dry-run)        DRY_RUN=1; shift ;;
        --help|-h)        usage; exit 0 ;;
        *)                die "unknown option '$1'" ;;
    esac
done

[ -n "$TITLE" ] || { usage; die "--title is required"; }

ARGS=(api repos/:owner/:repo/milestones -f "title=$TITLE")
[ -n "$DESC" ] && ARGS+=(-f "description=$DESC")
[ -n "$DUE" ]  && ARGS+=(-f "due_on=${DUE}T08:00:00Z")

if [ "$DRY_RUN" -eq 1 ]; then
    printf 'gh'; printf ' %q' "${ARGS[@]}"; printf '\n'
    exit 0
fi

# Idempotent: reuse an existing milestone with the same title.
EXISTING="$(gh api --paginate repos/:owner/:repo/milestones --jq \
    ".[] | select(.title == \"$TITLE\") | .number" 2>/dev/null | head -1 || true)"
if [ -n "$EXISTING" ]; then
    echo "milestone already exists: #$EXISTING $TITLE"
    exit 0
fi

gh "${ARGS[@]}" --jq '"created milestone #\(.number): \(.title)"'

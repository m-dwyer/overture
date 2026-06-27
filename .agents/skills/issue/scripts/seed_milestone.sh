#!/usr/bin/env bash
# Seed a milestone and its issues from a deterministic JSON manifest.
#
# Usage:
#   scripts/seed_milestone.sh --manifest /tmp/m1.json [--dry-run]
#
# Manifest shape:
# {
#   "milestone": {
#     "title": "M1: Schwung Playback Bring-Up",
#     "description": "Milestone summary",
#     "due": "2026-09-01"
#   },
#   "project": "5",
#   "status": "Backlog",
#   "priority": "P2 Medium",
#   "issues": [
#     {
#       "type": "architecture",
#       "title": "refactor: route host commands by track route",
#       "body_file": "01-route-aware-host-commands.md",
#       "priority": "P1 High",
#       "labels": ["emulator"],
#       "assignees": ["@me"]
#     }
#   ]
# }

set -euo pipefail

MANIFEST=""
DRY_RUN=0

usage() { sed -n '2,31p' "$0" >&2; }
die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --manifest|-m) [ $# -ge 2 ] || die "--manifest requires a value"; MANIFEST="$2"; shift 2 ;;
        --dry-run)     DRY_RUN=1; shift ;;
        --help|-h)     usage; exit 0 ;;
        *)             die "unknown option '$1'" ;;
    esac
done

[ -n "$MANIFEST" ] || { usage; die "--manifest is required"; }
[ -f "$MANIFEST" ] || die "manifest not found: $MANIFEST"
command -v jq >/dev/null 2>&1 || die "jq is required"

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_DIR="$(cd "$(dirname "$MANIFEST")" && pwd)"
MANIFEST_PATH="$MANIFEST_DIR/$(basename "$MANIFEST")"
cd "$REPO_ROOT"

required_string() {
    local query="$1" name="$2" value
    value="$(jq -r "$query // empty" "$MANIFEST_PATH")"
    [ -n "$value" ] || die "manifest is missing $name"
    printf '%s' "$value"
}

optional_string() {
    local query="$1"
    jq -r "$query // empty" "$MANIFEST_PATH"
}

resolve_path() {
    local path="$1"
    case "$path" in
        /*) printf '%s' "$path" ;;
        *)  printf '%s/%s' "$MANIFEST_DIR" "$path" ;;
    esac
}

MILESTONE_TITLE="$(required_string '.milestone.title' "milestone.title")"
MILESTONE_DESC="$(optional_string '.milestone.description')"
MILESTONE_DUE="$(optional_string '.milestone.due')"
DEFAULT_PROJECT="$(optional_string '.project')"
DEFAULT_STATUS="$(optional_string '.status')"
DEFAULT_PRIORITY="$(optional_string '.priority')"

MILESTONE_CMD=("$SCRIPT_DIR/create_milestone.sh" --title "$MILESTONE_TITLE")
[ -n "$MILESTONE_DESC" ] && MILESTONE_CMD+=(--description "$MILESTONE_DESC")
[ -n "$MILESTONE_DUE" ] && MILESTONE_CMD+=(--due "$MILESTONE_DUE")
[ "$DRY_RUN" -eq 1 ] && MILESTONE_CMD+=(--dry-run)
"${MILESTONE_CMD[@]}"

ISSUE_COUNT="$(jq '.issues | length' "$MANIFEST_PATH")"
[ "$ISSUE_COUNT" -gt 0 ] || die "manifest must contain at least one issue"

for ((i = 0; i < ISSUE_COUNT; i++)); do
    TYPE="$(required_string ".issues[$i].type" "issues[$i].type")"
    TITLE="$(required_string ".issues[$i].title" "issues[$i].title")"
    BODY="$(optional_string ".issues[$i].body")"
    BODY_FILE="$(optional_string ".issues[$i].body_file")"
    PROJECT="$(optional_string ".issues[$i].project")"
    STATUS="$(optional_string ".issues[$i].status")"
    PRIORITY="$(optional_string ".issues[$i].priority")"
    NO_PROJECT="$(jq -r ".issues[$i].no_project // false" "$MANIFEST_PATH")"

    ISSUE_CMD=("$SCRIPT_DIR/create_issue.sh" --type "$TYPE" --title "$TITLE" --milestone "$MILESTONE_TITLE")
    if [ -n "$BODY_FILE" ]; then
        RESOLVED_BODY_FILE="$(resolve_path "$BODY_FILE")"
        [ -f "$RESOLVED_BODY_FILE" ] || die "body_file not found for issue $i: $RESOLVED_BODY_FILE"
        ISSUE_CMD+=(--body-file "$RESOLVED_BODY_FILE")
    elif [ -n "$BODY" ]; then
        ISSUE_CMD+=(--body "$BODY")
    fi

    while IFS= read -r label; do
        [ -n "$label" ] && ISSUE_CMD+=(--label "$label")
    done < <(jq -r ".issues[$i].labels[]? // empty" "$MANIFEST_PATH")

    while IFS= read -r assignee; do
        [ -n "$assignee" ] && ISSUE_CMD+=(--assignee "$assignee")
    done < <(jq -r ".issues[$i].assignees[]? // empty" "$MANIFEST_PATH")

    if [ "$NO_PROJECT" = "true" ]; then
        ISSUE_CMD+=(--no-project)
    else
        [ -n "$PROJECT" ] || PROJECT="$DEFAULT_PROJECT"
        [ -n "$STATUS" ] || STATUS="$DEFAULT_STATUS"
        [ -n "$PRIORITY" ] || PRIORITY="$DEFAULT_PRIORITY"
        [ -n "$PROJECT" ] && ISSUE_CMD+=(--project "$PROJECT")
        [ -n "$STATUS" ] && ISSUE_CMD+=(--status "$STATUS")
        [ -n "$PRIORITY" ] && ISSUE_CMD+=(--priority "$PRIORITY")
    fi

    [ "$DRY_RUN" -eq 1 ] && ISSUE_CMD+=(--dry-run)
    "${ISSUE_CMD[@]}"
done

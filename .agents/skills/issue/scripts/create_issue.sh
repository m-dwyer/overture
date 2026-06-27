#!/usr/bin/env bash
# Create a typed GitHub issue, optionally under a milestone and on the project board.
#
# Usage:
#   scripts/create_issue.sh --type feature --title "feat: ..." [options]
#
# Options:
#   --type,  -T  <type>     Required. One of: bug feature refactor architecture
#                           perf test docs chore. Sets the canonical type label.
#   --title, -t  <text>     Required. Use a Conventional Commit subject.
#   --body,  -b  <text>     Issue body text.
#   --body-file  <path>     Issue body from a file (overrides --body).
#   --milestone, -m <name>  Attach to this milestone (must exist unless --create-milestone).
#   --create-milestone      Create the milestone if it does not exist.
#   --label, -l  <name>     Extra label (repeatable). Use for area labels like dsp.
#   --assignee, -a <login>  Assignee (repeatable). Use @me for yourself.
#   --project, -p <number>  Project board to add to (default: Overture Roadmap).
#   --no-project            Do not add the issue to any project board.
#   --status, -s <name>     Board Status to set (default: Backlog).
#   --priority <name>       Board Priority to set, e.g. "P1 High".
#   --dry-run               Print the gh command instead of creating the issue.
#
# Labels are the source of truth for type; the project Type field is a mirror.
# By default the issue lands on the board in Backlog, typed, ready to triage.

set -euo pipefail

# New issues land on the project board in Backlog by default.
DEFAULT_PROJECT="5"   # Overture Roadmap

TYPE=""
TITLE=""
BODY=""
BODY_FILE=""
MILESTONE=""
CREATE_MILESTONE=0
PROJECT="$DEFAULT_PROJECT"
STATUS="Backlog"
PRIORITY=""
DRY_RUN=0
EXTRA_LABELS=()
ASSIGNEES=()

usage() { sed -n '2,24p' "$0" >&2; }

die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --type|-T)       [ $# -ge 2 ] || die "--type requires a value"; TYPE="$2"; shift 2 ;;
        --title|-t)      [ $# -ge 2 ] || die "--title requires a value"; TITLE="$2"; shift 2 ;;
        --body|-b)       [ $# -ge 2 ] || die "--body requires a value"; BODY="$2"; shift 2 ;;
        --body-file)     [ $# -ge 2 ] || die "--body-file requires a value"; BODY_FILE="$2"; shift 2 ;;
        --milestone|-m)  [ $# -ge 2 ] || die "--milestone requires a value"; MILESTONE="$2"; shift 2 ;;
        --create-milestone) CREATE_MILESTONE=1; shift ;;
        --label|-l)      [ $# -ge 2 ] || die "--label requires a value"; EXTRA_LABELS+=("$2"); shift 2 ;;
        --assignee|-a)   [ $# -ge 2 ] || die "--assignee requires a value"; ASSIGNEES+=("$2"); shift 2 ;;
        --project|-p)    [ $# -ge 2 ] || die "--project requires a value"; PROJECT="$2"; shift 2 ;;
        --no-project)    PROJECT=""; shift ;;
        --status|-s)     [ $# -ge 2 ] || die "--status requires a value"; STATUS="$2"; shift 2 ;;
        --priority)      [ $# -ge 2 ] || die "--priority requires a value"; PRIORITY="$2"; shift 2 ;;
        --dry-run)       DRY_RUN=1; shift ;;
        --help|-h)       usage; exit 0 ;;
        *)               die "unknown option '$1'" ;;
    esac
done

[ -n "$TYPE" ]  || { usage; die "--type is required"; }
[ -n "$TITLE" ] || { usage; die "--title is required"; }

# Map type -> canonical label. The Type field option name is matched separately.
case "$TYPE" in
    bug)          TYPE_LABEL="bug" ;;
    feature)      TYPE_LABEL="feature" ;;
    refactor)     TYPE_LABEL="refactor" ;;
    architecture) TYPE_LABEL="architecture" ;;
    perf)         TYPE_LABEL="perf" ;;
    test)         TYPE_LABEL="test" ;;
    docs)         TYPE_LABEL="documentation" ;;
    chore)        TYPE_LABEL="chore" ;;
    *) die "unknown type '$TYPE' (valid: bug feature refactor architecture perf test docs chore)" ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Ensure the milestone exists when requested.
if [ -n "$MILESTONE" ] && [ "$CREATE_MILESTONE" -eq 1 ]; then
    EXISTS="$(gh api --paginate repos/:owner/:repo/milestones --jq \
        ".[] | select(.title == \"$MILESTONE\") | .number" 2>/dev/null | head -1 || true)"
    if [ -z "$EXISTS" ]; then
        if [ "$DRY_RUN" -eq 1 ]; then
            echo "[dry-run] would create milestone: $MILESTONE"
        else
            gh api repos/:owner/:repo/milestones -f title="$MILESTONE" --jq '"created milestone #\(.number): \(.title)"'
        fi
    fi
fi

# Assemble the gh issue create invocation.
ARGS=(issue create --title "$TITLE" --label "$TYPE_LABEL")
for l in "${EXTRA_LABELS[@]:-}"; do [ -n "$l" ] && ARGS+=(--label "$l"); done
for a in "${ASSIGNEES[@]:-}"; do [ -n "$a" ] && ARGS+=(--assignee "$a"); done
[ -n "$MILESTONE" ] && ARGS+=(--milestone "$MILESTONE")
if [ -n "$BODY_FILE" ]; then
    ARGS+=(--body-file "$BODY_FILE")
elif [ -n "$BODY" ]; then
    ARGS+=(--body "$BODY")
else
    ARGS+=(--body "")
fi

if [ "$DRY_RUN" -eq 1 ]; then
    printf 'gh'; printf ' %q' "${ARGS[@]}"; printf '\n'
    if [ -n "$PROJECT" ]; then
        echo "[dry-run] would add to project $PROJECT, set Type = $TYPE, Status = $STATUS${PRIORITY:+, Priority = $PRIORITY}"
    fi
    exit 0
fi

ISSUE_URL="$(gh "${ARGS[@]}")"
echo "$ISSUE_URL"

# Set a single-select field on the item by matching an option name (case-insensitive).
# Usage: set_select_field <field-name> <value>
set_select_field() {
    local field="$1" value="$2" field_id option_id
    field_id="$(printf '%s' "$FIELDS_JSON" | jq -r --arg f "$field" \
        '.fields[] | select(.name==$f) | .id')"
    option_id="$(printf '%s' "$FIELDS_JSON" | jq -r --arg f "$field" --arg v "$value" \
        '.fields[] | select(.name==$f) | .options[] | select(.name | ascii_downcase | contains($v | ascii_downcase)) | .id' | head -1)"
    if [ -n "$field_id" ] && [ -n "$option_id" ]; then
        gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
            --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null
        echo "  $field = $value"
    else
        echo "warn: could not set $field = $value (no matching option)" >&2
    fi
}

# Add to the board and mirror Type + Status.
if [ -n "$PROJECT" ]; then
    OWNER="$(gh repo view --json owner --jq .owner.login)"
    PROJECT_ID="$(gh project view "$PROJECT" --owner "$OWNER" --format json --jq .id)" || {
        echo "warn: could not resolve project $PROJECT; skipping board" >&2; exit 0; }
    FIELDS_JSON="$(gh project field-list "$PROJECT" --owner "$OWNER" --format json)"
    ITEM_ID="$(gh project item-add "$PROJECT" --owner "$OWNER" --url "$ISSUE_URL" --format json --jq .id)"
    echo "added to project $PROJECT:"
    set_select_field "Type" "$TYPE"
    [ -n "$STATUS" ] && set_select_field "Status" "$STATUS"
    [ -n "$PRIORITY" ] && set_select_field "Priority" "$PRIORITY"
fi

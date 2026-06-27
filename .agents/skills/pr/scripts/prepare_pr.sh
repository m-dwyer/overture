#!/usr/bin/env bash
# Prepare a pull request body from the canonical .github/pull_request_template.md.
#
# Usage:
#   scripts/prepare_pr.sh [--base main] [--title "docs: update workflow"] [--issue 42] [--output .pr-body.md]
#   gh pr create --base main --title "docs: update workflow" --body-file .pr-body.md
#
# The body is the repo's PR template verbatim; the only substitution is the
# closing keyword. Pass --issue <n> to fill `Closes #<n>` (auto-closes on merge);
# omit it (or pass --issue 0) to leave the template's blank `Closes #`.
#
# Branch/commit/diff context is printed for drafting only and is NOT written into
# the body -- GitHub already shows commits and the diff on the PR page.

set -euo pipefail

BASE_REF="main"
OUT_FILE="${PR_BODY_FILE:-.pr-body.md}"
PR_TITLE=""
ISSUE_NUMBER=""

usage() {
    sed -n '2,13p' "$0" >&2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --base|-b)
            if [ $# -lt 2 ]; then echo "error: --base requires a value" >&2; exit 1; fi
            BASE_REF="$2"; shift 2 ;;
        --title|-t)
            if [ $# -lt 2 ]; then echo "error: --title requires a value" >&2; exit 1; fi
            PR_TITLE="$2"; shift 2 ;;
        --issue|-i)
            if [ $# -lt 2 ]; then echo "error: --issue requires a value" >&2; exit 1; fi
            ISSUE_NUMBER="$2"; shift 2 ;;
        --output|-o)
            if [ $# -lt 2 ]; then echo "error: --output requires a value" >&2; exit 1; fi
            OUT_FILE="$2"; shift 2 ;;
        --help|-h)
            usage; exit 0 ;;
        -*)
            echo "error: unknown option '$1'" >&2; usage; exit 1 ;;
        *)
            BASE_REF="$1"; shift ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TEMPLATE=".github/pull_request_template.md"
[ -f "$TEMPLATE" ] || { echo "error: PR template not found: $TEMPLATE" >&2; exit 1; }

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    if git rev-parse --verify --quiet "origin/$BASE_REF" >/dev/null; then
        BASE_REF="origin/$BASE_REF"
    else
        echo "error: base ref '$BASE_REF' not found" >&2
        exit 1
    fi
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
BRANCH_NAME="$(git branch --show-current)"
[ -n "$PR_TITLE" ] || PR_TITLE="$(git log -1 --pretty=%s)"
COMMIT_COUNT="$(git rev-list --count "$MERGE_BASE"..HEAD)"

# Body = the canonical template; the only edit is filling the closing keyword.
mkdir -p "$(dirname "$OUT_FILE")"
if [ -n "$ISSUE_NUMBER" ] && [ "$ISSUE_NUMBER" != "0" ]; then
    sed "s|^Closes #\$|Closes #$ISSUE_NUMBER|" "$TEMPLATE" > "$OUT_FILE"
else
    cp "$TEMPLATE" "$OUT_FILE"
fi
echo "Wrote $OUT_FILE (from $TEMPLATE)"

# Drafting context only -- not part of the PR body.
if git diff-index --quiet HEAD -- && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    TREE_STATUS="clean"
else
    TREE_STATUS="dirty - commit or exclude local changes before opening the PR"
fi
{
    echo
    echo "Drafting context (not written to the body):"
    echo "  branch: $BRANCH_NAME -> ${BASE_REF#origin/}   ($COMMIT_COUNT commit(s), tree $TREE_STATUS)"
    echo "  title:  $PR_TITLE"
    if [ "$COMMIT_COUNT" -gt 0 ]; then
        echo "  commits:"
        git log --no-merges --format='    - %s' "$MERGE_BASE"..HEAD
        echo "  diffstat:"
        git diff --stat "$MERGE_BASE"..HEAD | sed 's/^/    /'
    fi
} >&2

echo
echo "Create the PR with:"
echo "  gh pr create --base ${BASE_REF#origin/} --title \"$PR_TITLE\" --body-file $OUT_FILE"

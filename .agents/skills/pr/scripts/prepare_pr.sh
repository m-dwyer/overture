#!/usr/bin/env bash
# Prepare a deterministic pull request body for gh pr create.
#
# Usage:
#   scripts/prepare_pr.sh [--base main] [--title "docs: update workflow"] [--issue 42] [--output .pr-body.md]
#   gh pr create --base main --title "docs: update workflow" --body-file .pr-body.md
#
# The issue number is auto-detected from the branch name (e.g. feat/42-slug).
# Pass --issue to override, or --issue 0 to omit the closing keyword.

set -euo pipefail

BASE_REF="main"
OUT_FILE="${PR_BODY_FILE:-.pr-body.md}"
PR_TITLE=""
ISSUE_NUMBER=""

usage() {
    sed -n '2,9p' "$0" >&2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --base|-b)
            if [ $# -lt 2 ]; then
                echo "error: --base requires a value" >&2
                exit 1
            fi
            BASE_REF="$2"
            shift 2
            ;;
        --title|-t)
            if [ $# -lt 2 ]; then
                echo "error: --title requires a value" >&2
                exit 1
            fi
            PR_TITLE="$2"
            shift 2
            ;;
        --issue|-i)
            if [ $# -lt 2 ]; then
                echo "error: --issue requires a value" >&2
                exit 1
            fi
            ISSUE_NUMBER="$2"
            shift 2
            ;;
        --output|-o)
            if [ $# -lt 2 ]; then
                echo "error: --output requires a value" >&2
                exit 1
            fi
            OUT_FILE="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        -*)
            echo "error: unknown option '$1'" >&2
            usage
            exit 1
            ;;
        *)
            BASE_REF="$1"
            shift
            ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

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
if [ -z "$PR_TITLE" ]; then
    PR_TITLE="$(git log -1 --pretty=%s)"
fi
COMMIT_COUNT="$(git rev-list --count "$MERGE_BASE"..HEAD)"

# Auto-detect the issue number from a <type>/<number>-<slug> branch when not given.
if [ -z "$ISSUE_NUMBER" ]; then
    ISSUE_NUMBER="$(printf '%s' "$BRANCH_NAME" | sed -nE 's#^[^/]+/0*([1-9][0-9]*)[-_].*#\1#p')"
fi
if [ "$ISSUE_NUMBER" = "0" ] || [ -z "$ISSUE_NUMBER" ]; then
    RELATED_ISSUE="<!-- No issue detected from the branch. Add \`Closes #<n>\` to auto-close on merge. -->
Closes #"
else
    RELATED_ISSUE="Closes #$ISSUE_NUMBER"
fi

if [ "$COMMIT_COUNT" -gt 0 ]; then
    COMMITS="$(git log --no-merges --format='- %s' "$MERGE_BASE"..HEAD)"
else
    COMMITS="- No commits yet on this branch."
fi

CHANGED_FILES="$(git diff --name-only "$MERGE_BASE"..HEAD)"
if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES="- No committed file changes yet."
else
    CHANGED_FILES="$(printf "%s\n" "$CHANGED_FILES" | sed 's/^/- /')"
fi

DIFF_STAT="$(git diff --stat "$MERGE_BASE"..HEAD)"
if [ -z "$DIFF_STAT" ]; then
    DIFF_STAT="No committed diff yet."
fi

if git diff-index --quiet HEAD -- && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    TREE_STATUS="Clean"
else
    TREE_STATUS="Dirty - commit or intentionally exclude local changes before opening the PR."
fi

DOCS_ONLY="No"
if [ "$COMMIT_COUNT" -gt 0 ]; then
    NON_DOC_FILES="$(git diff --name-only "$MERGE_BASE"..HEAD | grep -Ev '^(AGENTS\.md|CLAUDE\.md|README\.md|docs/|overture-ui/docs/|\.github/pull_request_template\.md|.*\.md$)' || true)"
    if [ -z "$NON_DOC_FILES" ]; then
        DOCS_ONLY="Yes"
    fi
fi

mkdir -p "$(dirname "$OUT_FILE")"
cat > "$OUT_FILE" <<EOF
## Summary

-

## Related issue

$RELATED_ISSUE

## Verification

- [ ] \`cd overture-ui && pnpm verify\`
- [ ] Emulator
- [ ] Hardware
- [ ] Not run / not applicable:

## User-visible changes

- Docs-only: $DOCS_ONLY
- Changelog updated:
- Manual updated:

## Follow-up / risk

- Working tree: $TREE_STATUS

## Branch metadata

- Branch: \`$BRANCH_NAME\`
- Base: \`$BASE_REF\`
- Suggested title: \`$PR_TITLE\`
- Commits since base: $COMMIT_COUNT

## Commits

$COMMITS

## Changed files

$CHANGED_FILES

## Diff stat

\`\`\`
$DIFF_STAT
\`\`\`
EOF

echo "Wrote $OUT_FILE"
echo
echo "Create the PR with:"
echo "  gh pr create --base ${BASE_REF#origin/} --title \"$PR_TITLE\" --body-file $OUT_FILE"

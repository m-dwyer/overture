#!/usr/bin/env bash
# Create a pull request deterministically from the branch's commits -- no LLM
# body authoring. The body mirrors `gh pr create --fill-verbose`.
#
# Usage:
#   create_pr.sh [--base main] [--title "..."] [--issue 42] [--draft] [--dry-run]
#   create_pr.sh --rich [...]    # author a template-based body instead
#
# Default: title = first commit subject (override with --title); body = the
# branch's commit messages; with --issue, append `Closes #<n>`. Pushes the
# branch if it has no upstream. Use --rich only when a PR genuinely needs
# hand-written narrative beyond what the commits already say.

set -euo pipefail

BASE_REF="main"
TITLE=""
ISSUE=""
DRAFT=0
DRYRUN=0
RICH=0

usage() { sed -n '2,14p' "$0" >&2; }
die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --base|-b)  [ $# -ge 2 ] || die "--base requires a value"; BASE_REF="$2"; shift 2 ;;
        --title|-t) [ $# -ge 2 ] || die "--title requires a value"; TITLE="$2"; shift 2 ;;
        --issue|-i) [ $# -ge 2 ] || die "--issue requires a value"; ISSUE="$2"; shift 2 ;;
        --draft)    DRAFT=1; shift ;;
        --rich)     RICH=1; shift ;;
        --dry-run)  DRYRUN=1; shift ;;
        --help|-h)  usage; exit 0 ;;
        *)          die "unknown option '$1'" ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Rich mode: hand-authored body from the canonical template (the costly path).
if [ "$RICH" -eq 1 ]; then
    RICH_ARGS=(--base "$BASE_REF")
    [ -n "$TITLE" ] && RICH_ARGS+=(--title "$TITLE")
    [ -n "$ISSUE" ] && RICH_ARGS+=(--issue "$ISSUE")
    exec bash "$(dirname "$0")/prepare_pr.sh" "${RICH_ARGS[@]}"
fi

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    if git rev-parse --verify --quiet "origin/$BASE_REF" >/dev/null; then
        BASE_REF="origin/$BASE_REF"
    else
        die "base ref '$BASE_REF' not found"
    fi
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"
[ "$(git rev-list --count "$MERGE_BASE"..HEAD)" -gt 0 ] || die "no commits on this branch vs ${BASE_REF#origin/}"

# Deterministic title + body straight from the commits.
[ -n "$TITLE" ] || TITLE="$(git log --reverse --no-merges --format='%s' "$MERGE_BASE"..HEAD | head -1)"
# Commit messages, minus co-author/sign-off trailers that just add noise.
BODY="$(git log --reverse --no-merges --format='%s%n%n%b' "$MERGE_BASE"..HEAD \
    | grep -viE '^(Co-Authored-By|Signed-off-by):' | cat -s)"
if [ -n "$ISSUE" ] && [ "$ISSUE" != "0" ]; then
    BODY="$BODY

Closes #$ISSUE"
fi

CREATE=(gh pr create --base "${BASE_REF#origin/}" --title "$TITLE" --body "$BODY")
[ "$DRAFT" -eq 1 ] && CREATE+=(--draft)

if [ "$DRYRUN" -eq 1 ]; then
    echo "title: $TITLE"
    echo "---- body ----"
    printf '%s\n' "$BODY"
    echo "--------------"
    printf 'cmd:'; printf ' %q' "${CREATE[@]}"; printf '\n'
    exit 0
fi

# Creating a PR requires the branch on the remote; push if it has no upstream.
if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git push -u origin HEAD
fi

"${CREATE[@]}"

#!/usr/bin/env bash
# Print the minimum useful verification plan for the current change.
#
# Usage:
#   scripts/select-verification.sh [--base main]
#   scripts/select-verification.sh --paths-file /tmp/changed-files.txt
#
# The selector is intentionally advisory. It reduces routine waste, but it is
# not a replacement for judgement when a change crosses runtime, hardware, or
# user-visible behavior.

set -euo pipefail

BASE_REF="main"
PATHS_FILE=""

usage() { sed -n '2,10p' "$0" >&2; }
die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --base|-b)       [ $# -ge 2 ] || die "--base requires a value"; BASE_REF="$2"; shift 2 ;;
        --paths-file|-p) [ $# -ge 2 ] || die "--paths-file requires a value"; PATHS_FILE="$2"; shift 2 ;;
        --help|-h)       usage; exit 0 ;;
        *)               die "unknown option '$1'" ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

declare -A SEEN=()
CHANGED=()
COMMANDS=()
NOTES=()
UNKNOWN=()

add_path() {
    local path="$1"
    [ -n "$path" ] || return 0
    if [ -z "${SEEN[$path]+x}" ]; then
        SEEN["$path"]=1
        CHANGED+=("$path")
    fi
}

add_command() {
    local command="$1"
    if [ -z "${SEEN["cmd:$command"]+x}" ]; then
        SEEN["cmd:$command"]=1
        COMMANDS+=("$command")
    fi
}

add_note() {
    local note="$1"
    if [ -z "${SEEN["note:$note"]+x}" ]; then
        SEEN["note:$note"]=1
        NOTES+=("$note")
    fi
}

if [ -n "$PATHS_FILE" ]; then
    [ -f "$PATHS_FILE" ] || die "paths file not found: $PATHS_FILE"
    while IFS= read -r path; do add_path "$path"; done < "$PATHS_FILE"
else
    DIFF_BASE="$BASE_REF"
    if ! git rev-parse --verify --quiet "$DIFF_BASE" >/dev/null; then
        if git rev-parse --verify --quiet "origin/$BASE_REF" >/dev/null; then
            DIFF_BASE="origin/$BASE_REF"
        else
            add_note "Base ref '$BASE_REF' was not found; using working tree changes only."
            DIFF_BASE=""
        fi
    fi

    if [ -n "$DIFF_BASE" ]; then
        while IFS= read -r path; do add_path "$path"; done < <(git diff --name-only "$DIFF_BASE"...HEAD)
    fi
    while IFS= read -r path; do add_path "$path"; done < <(git diff --name-only --cached)
    while IFS= read -r path; do add_path "$path"; done < <(git diff --name-only)
    while IFS= read -r path; do add_path "$path"; done < <(git ls-files --others --exclude-standard)
fi

for path in "${CHANGED[@]:-}"; do
    case "$path" in
        overture-next/*|web/*|mise.toml|.github/workflows/test.yml)
            add_command "pnpm -C web verify"
            ;;
    esac

    case "$path" in
        web/src/*|web/tests/*|web/playwright.config.ts|overture-next/src/runtime/*|overture-next/src/host/*|overture-next/ui/*)
            add_command "mise run test"
            ;;
    esac

    case "$path" in
        site/*)
            add_command "pnpm -C site build"
            ;;
    esac

    case "$path" in
        scripts/select-verification.sh)
            add_command "scripts/select-verification.sh --help"
            ;;
        .agents/skills/issue/SKILL.md|.agents/skills/issue/agents/*|.agents/skills/issue/scripts/*)
            add_command ".agents/skills/issue/scripts/create_issue.sh --help"
            add_command ".agents/skills/issue/scripts/create_milestone.sh --help"
            add_command ".agents/skills/issue/scripts/seed_milestone.sh --help"
            ;;
        .agents/skills/pr/SKILL.md|.agents/skills/pr/agents/*|.agents/skills/pr/scripts/*)
            add_command ".agents/skills/pr/scripts/create_pr.sh --help"
            ;;
    esac

    case "$path" in
        AGENTS.md|CONTEXT.md|README.md|docs/*|.github/pull_request_template.md|.agents/*|scripts/*|site/*|web/*|overture-next/*|mise.toml|pnpm-lock.yaml|package.json|.github/workflows/*)
            ;;
        *)
            UNKNOWN+=("$path")
            ;;
    esac
done

if [ "${#UNKNOWN[@]}" -gt 0 ]; then
    add_note "Unclassified paths changed; review whether broader verification is needed."
fi

if [ "${#CHANGED[@]}" -eq 0 ]; then
    echo "No changed files detected."
    exit 0
fi

echo "Changed files:"
for path in "${CHANGED[@]}"; do
    echo "- $path"
done

echo
echo "Recommended verification:"
if [ "${#COMMANDS[@]}" -eq 0 ]; then
    echo "- No automated checks selected for these paths."
else
    for command in "${COMMANDS[@]}"; do
        echo "- $command"
    done
fi

if [ "${#NOTES[@]}" -gt 0 ]; then
    echo
    echo "Notes:"
    for note in "${NOTES[@]}"; do
        echo "- $note"
    done
fi

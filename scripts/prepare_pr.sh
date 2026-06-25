#!/usr/bin/env bash
# Convenience wrapper for the PR Agent Skill script.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
exec "$REPO_ROOT/.agents/skills/pr/scripts/prepare_pr.sh" "$@"

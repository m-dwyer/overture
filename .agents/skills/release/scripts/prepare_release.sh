#!/usr/bin/env bash
# Preflight an Overture release without mutating the repository.

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "usage: $0 <version>   (e.g. 0.5.0 or v0.5.0)" >&2
    exit 1
fi

VERSION="${1#v}"
TAG="v${VERSION}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! printf '%s\n' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'; then
    echo "error: version must be SemVer-like, got '$VERSION'" >&2
    exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
TRACKED_DIRTY="No"
UNTRACKED_DIRTY="No"
TAG_EXISTS="No"
UNRELEASED_HAS_CONTENT="No"

if ! git diff-index --quiet HEAD --; then
    TRACKED_DIRTY="Yes"
fi

if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    UNTRACKED_DIRTY="Yes"
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
    TAG_EXISTS="Yes"
fi

if python3 - <<'PYEOF'
import pathlib
import re
import sys

text = pathlib.Path("overture-ui/CHANGELOG.md").read_text()
m = re.search(r"^## \[Unreleased\]\s*\n(.*?)(?=^## \[)", text, re.MULTILINE | re.DOTALL)
sys.exit(0 if m and m.group(1).strip() else 1)
PYEOF
then
    UNRELEASED_HAS_CONTENT="Yes"
fi

echo "Release preflight"
echo "  Version: $VERSION"
echo "  Tag: $TAG"
echo "  Branch: $CURRENT_BRANCH"
echo "  Tracked dirty: $TRACKED_DIRTY"
echo "  Untracked dirty: $UNTRACKED_DIRTY"
echo "  Tag exists: $TAG_EXISTS"
echo "  [Unreleased] has content: $UNRELEASED_HAS_CONTENT"
echo
echo "Commands after explicit confirmation:"
echo "  cd overture-ui && ./scripts/cut_release.sh $VERSION"
echo "  cd overture-ui && python3 scripts/condense_changelog.py $VERSION > dist/release-notes-v$VERSION.md"
echo "  cd overture-ui && gh release create $TAG dist/overture-module.tar.gz --title \"$TAG\" --notes-file dist/release-notes-v$VERSION.md"
echo "  cd overture-ui && ./scripts/draft_announcement.sh $VERSION"

if [ "$CURRENT_BRANCH" != "main" ] ||
   [ "$TRACKED_DIRTY" != "No" ] ||
   [ "$UNTRACKED_DIRTY" != "No" ] ||
   [ "$TAG_EXISTS" != "No" ] ||
   [ "$UNRELEASED_HAS_CONTENT" != "Yes" ]; then
    echo
    echo "Preflight status: blocked"
    exit 2
fi

echo
echo "Preflight status: ready"

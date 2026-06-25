---
name: release
description: Cut and publish an Overture release. Use only when the user explicitly asks to cut, prepare, or publish a release with a SemVer version.
---

Release actions tag, push, build a tarball, and may publish a GitHub release. Do not run mutating release commands until the user has provided an explicit SemVer version and confirmed the final plan.

Use this workflow:

1. Confirm the requested version, normalized without a leading `v`.
2. Verify the current branch is `main`.
3. Verify the working tree is clean, including no untracked files.
4. Verify `overture-ui/CHANGELOG.md` has non-empty `[Unreleased]` content.
5. Verify tag `v<version>` does not already exist.
6. Summarize the exact commands that will run and ask for confirmation.
7. After confirmation, run `cd overture-ui && ./scripts/cut_release.sh <version>`.
8. After the script succeeds, generate condensed release notes:
   `cd overture-ui && python3 scripts/condense_changelog.py <version> > dist/release-notes-v<version>.md`.
9. Publish the GitHub release:
   `cd overture-ui && gh release create v<version> dist/overture-module.tar.gz --title "v<version>" --notes-file dist/release-notes-v<version>.md`.
10. Draft the Discord announcement:
    `cd overture-ui && ./scripts/draft_announcement.sh <version>`.

If any preflight fails, stop and report the exact blocker. Do not improvise around dirty trees, missing changelog entries, existing tags, build failures, failed pushes, or GitHub release failures.

---
name: pr
description: Prepare a pull request for the current branch. Use when the user explicitly asks to prepare, draft, or create a PR for current branch changes.
---

Run `./scripts/prepare_pr.sh --base main`, then read `.pr-body.md`.

Fill only the judgment sections: `Summary`, `Verification`, `User-visible changes`, and `Follow-up / risk`.

Use committed branch changes as the source of truth. Do not paste full diffs into the response unless the user asks.

If the user explicitly asked to create the PR, run the generated `gh pr create ...` command after updating `.pr-body.md`. Otherwise, show the command.

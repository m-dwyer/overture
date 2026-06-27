---
name: pr
description: Create a pull request for the current branch. Use when the user explicitly asks to prepare, draft, or create a PR for current branch changes.
---

**Default — deterministic, no body authoring.** Run:

```sh
.agents/skills/pr/scripts/create_pr.sh --base main
```

It builds the PR title and body from the branch's commits (so write good commit
messages, not PR prose), pushes the branch if needed, and opens the PR. Flags:
`--issue <n>` appends `Closes #<n>`, `--title` overrides, `--draft`, `--dry-run`.
Do not hand-write a body for routine PRs — the commits are the source of truth.

**Rich — only when a PR needs narrative the commits don't carry** (big refactor,
risky migration). Run `create_pr.sh --rich --base main`, which writes
`.pr-body.md` from `.github/pull_request_template.md`. Fill only the judgment
sections (`Summary`, `Verification`, `User-visible changes`, `Follow-up / risk`),
then `gh pr create --body-file .pr-body.md`.

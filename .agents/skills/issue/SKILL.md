---
name: issue
description: Create GitHub issues and milestones for this repo. Use only when the user explicitly invokes this skill (/issue, or $issue in Codex). Do not invoke implicitly.
---

Router for filing tracked work. **Labels are the source of truth for type**; new
issues land on the Overture Roadmap board in **Backlog**. Run a script below, then
read its `--help` for the full flag set.

**Decide three things:** a `--type` (`bug feature refactor architecture perf test
docs chore`), a Conventional Commit `--title`, and an optional milestone.

- **Milestone** (optional, create first or reuse):
  `.agents/skills/issue/scripts/create_milestone.sh --title "..." [--due YYYY-MM-DD]`
  List existing: `gh api repos/:owner/:repo/milestones --jq '.[] | "\(.number)\t\(.title)"'`
- **Issue:**
  `.agents/skills/issue/scripts/create_issue.sh --type <type> --title "<subject>" [--milestone "<title>"]`

Both take `--dry-run`. See each script's `--help` for the rest (`--body-file`,
`--label`, `--status`, `--no-project`, `--create-milestone`).

**Start work** on an issue with a GitHub-linked branch (no naming convention; the
link is real data):

```sh
gh issue develop <number> --checkout
```

Then commit with Conventional Commit subjects. When preparing the PR, pass the
same number to the `pr` skill (`prepare_pr.sh --issue <number>`) so the body gets
`Closes #<number>`, and a squash-merge closes the issue and advances the milestone.

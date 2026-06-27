---
name: issue
description: Create GitHub issues and milestones for this repo. Use only when the user explicitly invokes this skill (/issue, or $issue in Codex). Do not invoke implicitly.
---

Router for filing tracked work. **Labels are the source of truth for type**; new
issues land on the Overture Roadmap board in **Backlog**. Run a script below, then
read its `--help` for the full flag set.

Before filing a milestone backlog, consolidate. Prefer 3-5 outcome-oriented
issues that each carry their own acceptance criteria. Do not create one issue
per implementation sub-step unless the user explicitly asks for granular tasks.
Use this balance rule: create separate issues only for independently valuable
outcomes, different owners, different risk classes, or work that may be
scheduled separately. Fold checklist-only steps, proof tests, and documentation
closeout into the nearest outcome issue.

For milestone seeding, first present a compact proposed issue list and ask for
confirmation when the user has not already approved the grouping. Once approved,
write one manifest and run `seed_milestone.sh --dry-run` before creating any
GitHub objects.

**Decide three things:** a `--type` (`bug feature refactor architecture perf test
docs chore`), a Conventional Commit `--title`, and an optional milestone.

- **Milestone** (optional, create first or reuse):
  `.agents/skills/issue/scripts/create_milestone.sh --title "..." [--due YYYY-MM-DD]`
  List existing: `gh api repos/:owner/:repo/milestones --jq '.[] | "\(.number)\t\(.title)"'`
- **Issue:**
  `.agents/skills/issue/scripts/create_issue.sh --type <type> --title "<subject>" [--milestone "<title>"]`
- **Seed a milestone deterministically from a JSON manifest** (preferred for
  multi-issue milestone setup):
  `.agents/skills/issue/scripts/seed_milestone.sh --manifest /tmp/milestone.json --dry-run`
  then rerun without `--dry-run` after checking the planned commands.

Both take `--dry-run`. See each script's `--help` for the rest (`--body-file`,
`--label`, `--status`, `--no-project`, `--create-milestone`).

For batch seeding, write short issue bodies to temp files and reference them
from the manifest with `body_file`. Keep the final response to links and the
open issue list; do not paste issue bodies unless asked.

**Start work** on an issue with a GitHub-linked branch (no naming convention; the
link is real data):

```sh
gh issue develop <number> --checkout
```

Then commit with Conventional Commit subjects. When preparing the PR, pass the
same number to the `pr` skill (`prepare_pr.sh --issue <number>`) so the body gets
`Closes #<number>`, and a squash-merge closes the issue and advances the milestone.

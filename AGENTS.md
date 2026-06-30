# Overture

**Working rule:** Before acting on any assumed or suggested cause/fix, read the
relevant code and verify the assumption is correct first.

Overture is a Schwung **tool module** (`component_type: "tool"`) for Ableton
Move. The current implementation lives under `overture-next/`; treat that path
as the active Overture source tree, not as a product name.

## Session Workflow

- **Validate before acting** - read or grep actual code first. Never act on
  assumptions.
- **Branching** - create a new branch for each refactor, major feature addition,
  or major revision (`git checkout -b <descriptive-name>` off `main` before code
  changes). Small, isolated fixes can land directly on `main`. When in doubt,
  branch.
- **Commits** - use one logical commit per completed change.
- **Do not push** unless the user explicitly asks.
- **AGENTS.md** - update after a major phase or when the working architecture
  changes, not after routine task work.
- **README.md** - keep the project overview and docs index current when repo
  level docs move or major user-facing surfaces change.
- **Releases** - use the `release` Agent Skill. Never cut a release without an
  explicit SemVer version from the user and a clean `main`.

## Commit Workflow

- Use Conventional Commit subjects: `feat:`, `fix:`, `perf:`, `docs:`,
  `refactor:`, `test:`, `build:`, `chore:`, or `release:`.
- Prefer concise, user-meaningful subjects, e.g. `fix: keep note preview on active track`.
- For user-visible workflow, control, display, pad/button, persistence, or
  manual-facing behavior changes, update the relevant docs in the same commit.
  Skip docs for internal-only architecture changes.
- Before committing a finished change, run
  `scripts/select-verification.sh --base main` and follow its recommended
  minimum checks. The selector is a minimum, not a ceiling: run broader checks
  when the risk is unclear.
- Before opening a PR, rerun the selector against the PR base if the branch has
  changed since the last verification.
- If the public site changes, also run `pnpm -C site build`.
- If a gate fails, fix the change. Do not loosen a ratchet to make a change pass.

## Active Architecture

The browser emulator and current test ratchet boot Overture from
`overture-next/ui/ui.js`.

Runtime-host contracts live in `overture-next/src/ports/`: inbound
control-surface contracts are in `inbound.ts`, outbound host surfaces are in
`outbound.ts`, and `host-ports.ts` composes them for the runtime. `src/host/`
implements the Schwung/Move adapter; `web/src/host/browser-emulator-harness.ts`
owns browser emulator composition and `web/src/host/emulator-harness.ts` owns
the browser-only `OVT` harness port.

The active source layers are `src/shared/` for neutral helpers,
`src/domain/` for pure musical vocabulary/data/transforms, `src/state/` for
mutable state owners such as `ControlSurfaceContext` and `OvertureProject`,
`src/application/` for control interpretation, intent application, transport,
playback, core read models, and host command contracts, then `src/ports/`,
`src/host/`, `src/view/`, `src/render/`, and `src/runtime/` at the edges.

Start with `CONTEXT.md` for domain language. For architecture work, read:

- `docs/ARCHITECTURE.md` for the active source-tree summary.
- `docs/architecture/target-architecture.md` for the feature-first target
  architecture and migration posture.
- `docs/architecture/module-boundaries.md` for layer ownership and public API
  boundaries.
- `docs/architecture/state-ownership.md` for mutable state-owner patterns.
- `docs/architecture/ratchets.md` for dependency-cruiser, ESLint, and test
  enforcement policy.

Do not add broad rules from memory. Verify the boundary is true first, then
ratchet it.

Overture package tests live under `overture-next/tests/`, grouped by layer or
module such as `tests/domain/`, `tests/state/`, `tests/application/`,
`tests/runtime/`, `tests/render/`, `tests/host/`, and `tests/view/`. Keep unit
tests aimed at public module entry points and use package integration tests for
cross-module application/runtime workflows. `web/tests/` is for the browser
emulator and web host harness, not Overture package unit coverage.

## Boy Scout Rule

Leave touched code more aligned with the documented architecture than you found
it. Keep cleanup incidental to the code you are already changing. When touching
an Overture module:

- preserve or improve its ownership boundary
- prefer public module APIs over deep/internal imports
- avoid adding new `doThing(state, ...)` APIs for owned mutable state
- match the module shape to ownership: use pure functions for pure transforms
  and projections; use a class or closure-backed owner when a concept owns
  mutable state, lifecycle, host capability probing, caching, mutation
  authority, or invariants
- avoid grab-bag files of loosely related functions; when touched code starts
  accumulating responsibilities, name the owned concept and deepen that module
  only if it concentrates real policy or authority
- add or tighten ratchets only after the boundary is true

For feature work, deliver the behavior first, then check whether touched code
can move one narrow step toward `docs/architecture/target-architecture.md`.
Deepen an interface only when it concentrates real policy, invariants, copying,
validation, lookup rules, or authority reduction. Avoid thin wrappers.

If a cleanup grows beyond the code you are touching, split it into its own
`refactor:` commit rather than expanding the current diff.

For a module with a sanctioned public entry point, add concise TSDoc to exported
domain verbs or boundary contracts when the signature alone does not capture
important semantics, invariants, side effects, or failure cases. Do not document
internal helpers just because they are exported across files inside `internal/`.
When a module needs state from another owner, pass a narrow read-only contract
instead of the mutable state object whenever practical.

## Dependency Ratchet

`pnpm verify` runs the active Overture package checks and focused web harness
tests. The dependency-cruiser and ESLint rules are executable architecture
ratchets. Never weaken them to make a change pass. For the ratchet model, read
`docs/architecture/ratchets.md`.

`src/**/internal/` directories are discovered by the dependency-cruiser config:
new internals are private to their nearest parent module, internalized modules
must expose `index.ts`, and matching package tests must live under the
corresponding `tests/` path.

## Build, Test, Debug

Common commands from the repo root:

```sh
scripts/select-verification.sh --base main  # choose relevant checks for this change
pnpm verify               # current Overture ratchet
pnpm -C overture-next verify  # active tool typecheck + dependency ratchet
pnpm -C web verify        # web harness typecheck + focused Overture tests
mise run test             # current ratchet + emulator E2E
pnpm -C site build        # public site check/build
mise run web-dev          # browser emulator
```

The emulator maps the on-device Schwung UI path to `overture-next/ui/`, so
source changes there are loaded directly in development.

## Schwung / Move Constraints

- **QuickJS compatibility:** Schwung `shadow_ui` runs QuickJS, not V8. Avoid
  syntax that QuickJS rejects. Known pitfall: member expressions as object keys
  are a syntax error (`{ S.shiftHeld: val }`); use plain identifiers.
- **Entry points:** public Schwung entrypoints are installed through
  `overture-next/src/host/schwung-runtime.ts`.
- **Raw host API:** keep direct calls to Schwung host functions isolated in
  `overture-next/src/host/`.
- **Move MIDI mapping:** keep Move packet construction, CC/note constants, and
  channel mapping in the host adapter.
- **Local server tests:** Playwright starts a local dev server. If sandboxing
  blocks binding to `::1:5180`, rerun the test command with escalation.

## Site

The public site lives in `site/`. Keep public copy aligned with the current
product language: the product is Overture, built on Schwung.

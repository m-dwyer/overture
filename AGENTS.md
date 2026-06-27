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

Layer responsibilities:

- `overture-next/ui/ui.js` is the Schwung compatibility shell. It creates the
  adapter/runtime and installs Schwung entrypoints. Keep it small.
- `overture-next/src/runtime/` owns application orchestration: init, tick,
  runtime readiness, boot splash policy, MIDI dispatch, command draining, and
  render calls.
- `overture-next/src/session-grid.ts` owns neutral Session grid geometry shared
  by control interpretation and view-model derivation.
- `overture-next/src/core/` owns groovebox domain state and decisions: project
  data, transport, control-surface state, control interpretation, domain
  intents, and domain host commands. Keep transient control focus and mode in
  explicit Control State, not in Overture Project data.
- `overture-next/src/host/` owns Schwung/Move translation. Raw `globalThis`,
  Schwung host function names, Move MIDI bytes, Move CC/note numbers, and
  track-to-Move-channel mapping belong here.
- `overture-next/src/ports/` owns typed boundary contracts between runtime,
  host, display, LEDs, MIDI, and command execution.
- `overture-next/src/view/` owns view-model data contracts.
- `overture-next/src/render/` is presentational. It renders view models through
  display/LED ports and must not own domain or host policy.

The host adapter converts raw Move MIDI input into typed control input. Core
interprets control input against Control State, applies resulting intents to
project/transport/control state, and emits domain commands such as
`track-note-on` and `track-note-off`; the host adapter converts those commands
to Move MIDI packets.

State owners should be the only modules that mutate their state shape:
`transport.ts` mutates `TransportState`; `playback/` mutates `PlaybackState`;
`control-state.ts` mutates `ControlState`; and `project/` mutates
`OvertureProject`. Cross-state workflows belong in orchestration code that calls
the owning modules' public verbs. `overture-next` enforces adopted ownership
boundaries with dependency-cruiser import rules and the local ESLint
`overture/state-ownership` rule.

Overture package tests live under `overture-next/tests/`, grouped by layer or
module such as `tests/core/`, `tests/runtime/`, `tests/render/`, `tests/host/`,
and `tests/view/`. Keep unit tests aimed at public module entry points and use
package integration tests for cross-module core/runtime workflows. `web/tests/`
is for the browser emulator and web host harness, not Overture package unit
coverage.

## Boy Scout Rule

Leave touched code more aligned with the target architecture than you found it.
This is about *incidental* cleanup to code you are already editing — the
[Active Architecture](#active-architecture) layer model and
[Dependency Ratchet](#dependency-ratchet) constraints apply to every change
regardless. When you touch an Overture module:

- **Encapsulation** - expose domain verbs before helper mutations. Put private
  helpers under an `internal/` folder, guarded by a dependency-cruiser rule.
- **Types** - move a contract you touch into its owning layer.
- **Language** - rename legacy naming where you touch it; do not carry it into
  new code or public copy.
- **Ratchets** - when a change makes an aspirational boundary real, tighten
  `overture-next/.dependency-cruiser.cjs` to lock it in.

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
tests. The dependency-cruiser rules are the architecture ratchet:

- core does not import host, render, runtime, or UI shell code.
- host adapters stay at the boundary and do not import core behavior or renderers.
- renderers stay presentational.
- runtime orchestrates through ports and does not import concrete host adapters.
- view types stay neutral.
- port types stay contracts.
- module `internal/` folders are private implementation details protected by
  dependency-cruiser as modules adopt them.

Never weaken these rules to make a change pass.

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

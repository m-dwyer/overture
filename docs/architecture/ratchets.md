# Architecture Ratchets

Ratchets are executable checks that prevent adopted boundaries from regressing.
They should describe boundaries that are already true, not aspirations that the
code still violates.

## Current Ratchet Types

- **dependency-cruiser** enforces import direction, layer boundaries, public
  entry points, and `internal/` privacy.
- **ESLint** enforces semantic boundaries that imports cannot express, such as
  state mutation ownership and exported state API shapes.
- **Tests** enforce behavioral expectations through public module APIs and
  package integration workflows.

`pnpm verify` runs the active Overture package checks and focused web harness
tests. Never weaken a ratchet to make a change pass.

## Dependency-Cruiser Boundaries

The dependency-cruiser rules are the architecture import ratchet:

- core does not import host, render, runtime, or UI shell code.
- host adapters stay at the boundary and do not import core behavior or
  renderers.
- renderers stay presentational.
- runtime orchestrates through ports and does not import host modules.
- view types stay neutral, while view projection may consume narrow read-only
  surface host contracts from ports.
- port types stay contracts.
- every `src/**/internal/` folder is private to its nearest parent module.
  The dependency-cruiser config discovers these folders and generates the
  matching privacy rules, so new internals are ratcheted as they are added.
- when an internalized module has an `index.ts`, the dependency-cruiser config
  also generates a public-entrypoint-only rule for imports from outside that
  module.
- nested internalized modules may expose their own public entry points, such as
  `src/view/session/index.ts`; parent public-entrypoint rules allow those child
  entry points while still blocking implementation-file imports.
- `pnpm -C overture-next test:lint-rules` checks that every internalized module
  has an `index.ts` public entry point and a matching test path under `tests/`.

Use dependency-cruiser when a boundary can be expressed as "this path may not
import that path."

## ESLint Boundaries

Use local ESLint rules when the boundary depends on TypeScript semantics rather
than import paths.

Current local rules:

- `overture/state-ownership` requires owned state shapes to be mutated only by
  their owning module.
- `overture/state-api-encapsulation` prevents public APIs from accepting adopted
  owned state objects as mutation targets.

Expand ESLint rule configuration only after a state owner has adopted the target
pattern. For example, do not add `TransportState` to a rule that `transport.ts`
does not yet satisfy.

## Ratchet Checklist

Before adding or tightening a ratchet:

1. Verify the desired boundary is already true with `rg`, imports, and tests.
2. Add the smallest rule that captures the adopted boundary.
3. Add focused rule tests when changing local ESLint behavior.
4. Run `scripts/select-verification.sh --base main` and follow the result.
5. Keep the rule strict. If it fails later, fix the code instead of weakening
   the ratchet.

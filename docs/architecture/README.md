# Architecture Playbooks

These notes turn the domain language in `CONTEXT.md` into source ownership,
module boundaries, target architecture, and executable ratchets. They are
intentionally more detailed than `AGENTS.md`; read them when a task touches
architecture, boundaries, state ownership, or verification policy.

## Reading Order

1. `CONTEXT.md` names the domain concepts, workflows, and invariants.
2. `docs/ARCHITECTURE.md` summarizes the active source tree.
3. `target-architecture.md` describes the feature-first direction of travel.
4. `control-contexts.md` describes root views, future pages, overlays, and
   restorable interaction context.
5. `module-boundaries.md` maps layers and module entry points.
6. `state-ownership.md` describes mutable state owners and read contracts.
7. `ratchets.md` explains when and how to enforce adopted boundaries.

## CONTEXT to Ratchets Workflow

Use this process for both new and existing codebases:

1. **Model the domain** in `CONTEXT.md`. Name concepts, workflows, invariants,
   and avoided language before choosing code structure.
2. **Assign ownership** in architecture docs. Decide which module owns each
   concept, state shape, public API, private helper, and read contract.
3. **Move one boundary at a time**. Read imports and call sites first, then
   refactor only the narrow boundary that is already justified by the code.
4. **Test behavior through public APIs**. Unit tests should target module entry
   points; integration tests should cover cross-module workflows.
5. **Ratchet only true boundaries**. Add dependency-cruiser or ESLint rules only
   after the code already satisfies the boundary.
6. **Keep operating guidance short**. `AGENTS.md` routes contributors to the
   right deeper document instead of embedding the full architecture manual.

## Module Maturity Ladder

Use the ladder to make progress without broad rewrites:

| Level | Boundary Maturity                                                     |
| ----- | --------------------------------------------------------------------- |
| 0     | Code exists, but ownership is informal.                               |
| 1     | The domain concept is named in `CONTEXT.md`.                          |
| 2     | The owning module or layer is identified.                             |
| 3     | A public API or entry point exists.                                   |
| 4     | Private helpers live behind `internal/` or equivalent module privacy. |
| 5     | Mutable state is encapsulated behind owner methods or public verbs.   |
| 6     | Dependency-cruiser, ESLint, or tests prevent regression.              |

Do not force every module to level 6 up front. Raise the maturity of touched
modules as the need becomes concrete.

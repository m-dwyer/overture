# Upstream Lineage

Overture is a thick fork of dAVEBOx's tool module. Overture has its own release
version; upstream dAVEBOx lineage is tracked separately so package versions do
not have to pretend the fork is still identical to upstream.

## Current Baseline

- Overture package version: `1.1.0`
- Upstream Schwung host pin: `v0.9.18` (`0221f3ff`), first verified upstream
  tag used by Overture with `shadow_corun_begin/end/state`.
- Upstream dAVEBOx baseline: `1.0b3`
- Tool baseline commit before Overture-only Phase 5 work: `7cf3e71`
- Parent integration commit that completed the Phase 4 upstream bug-fix port:
  `8ec4de6`
- DSP state version: `36`

The DSP state version is independent of package version. Do not bump it for
branding, documentation, UI-only changes, or upstream-port bookkeeping; bump it
only when persisted state format compatibility genuinely changes.

## Versioning Rule

- `tool/module.json` and `tool/release.json` carry Overture's install/update
  version.
- `schwung/` is pinned independently to the upstream Schwung host version used
  for build/install integration.
- This file records the dAVEBOx baseline and port status.
- Future dAVEBOx catch-up work should update this file with the upstream tag or
  commit, the Overture parent commit that performed the port, and any skipped or
  intentionally diverged changes.

## Port Ledger

| Overture phase | Upstream baseline | Parent commit | Tool commit | Notes |
|---|---|---|---|---|
| Phase 4: low-risk upstream fixes | dAVEBOx `1.0b3` | `8ec4de6` | `7cf3e71` | Ported the roadmap-listed bug fixes while preserving Overture side-button track navigation, hold-side clip reveal, branding/import paths, WASM/emulator additions, and DSP refactor layout. |
| Phase 5: Parameter Discoverability | dAVEBOx `1.0b3` + Overture Phase 4 | `893ed3d` | `bcab286` | Overture-only UX work: Param Peek, AUTO lane labels, and Shift shortcut overlay. |

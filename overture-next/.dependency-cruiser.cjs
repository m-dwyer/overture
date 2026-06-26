/**
 * dependency-cruiser config for Overture Next.
 *
 * This is an evolutionary-architecture ratchet: every `error` rule describes a
 * boundary that is already true and must not regress. Add new rules as `warn`
 * only when they describe known, counted debt; promote them to `error` once the
 * count reaches zero.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No import cycles. Keep modules independently understandable.",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Imports must resolve in the emulator/dev graph.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-import-composition-root",
      severity: "error",
      comment:
        "ui/ui.js is the Schwung compatibility shell that owns global entrypoints; nothing imports it.",
      from: { pathNot: "^ui/ui\\.js$" },
      to: { path: "^ui/ui\\.js$" },
    },
    {
      name: "source-does-not-import-runtime-shell",
      severity: "error",
      comment: "Typed source modules do not depend on the runtime shell.",
      from: { path: "^src/" },
      to: { path: "^ui/" },
    },
    {
      name: "core-does-not-know-host-or-render",
      severity: "error",
      comment: "Core owns domain state and decisions; it must not import host adapters, renderers, runtime orchestration, or UI shell code.",
      from: { path: "^src/core/" },
      to: { path: "^(src/(host|render|runtime)/|ui/)" },
    },
    {
      name: "host-stays-at-boundary",
      severity: "error",
      comment:
        "Host adapters translate commands and surfaces only. They may use core/types, but not core behavior or renderers.",
      from: { path: "^src/host/" },
      to: { path: "^(src/core/(core|input|pattern|track|transport)\\.ts$|src/(render|runtime)/|ui/)" },
    },
    {
      name: "render-stays-presentational",
      severity: "error",
      comment:
        "Renderers consume view types and surfaces. They must not import host adapters or core behavior modules.",
      from: { path: "^src/render/" },
      to: { path: "^(src/(host|runtime)/|src/core/(core|input|pattern|track|transport)\\.ts$|ui/)" },
    },
    {
      name: "runtime-owns-orchestration",
      severity: "error",
      comment:
        "Runtime coordinates core, renderers, and host ports; lower layers must not import runtime modules.",
      from: { path: "^src/(core|host|render)/" },
      to: { path: "^src/runtime/" },
    },
    {
      name: "runtime-uses-host-ports",
      severity: "error",
      comment: "Runtime depends on host port types, not concrete Schwung adapters.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/host/(?!types\\.ts$)" },
    },
    {
      name: "no-next-imports-legacy-ui",
      severity: "error",
      comment: "Overture Next must not depend on the legacy dAVEBOx-derived UI implementation.",
      from: { path: "^(src|ui)/" },
      to: { path: "^../overture-ui/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".js", ".mjs", ".d.ts"],
    },
  },
};

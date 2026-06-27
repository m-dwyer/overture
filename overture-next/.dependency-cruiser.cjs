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
      name: "session-grid-stays-neutral",
      severity: "error",
      comment: "Shared Session grid geometry is pure coordinate math and must not depend on application layers.",
      from: { path: "^src/session-grid\\.ts$" },
      to: { path: "^(src/(core|host|ports|render|runtime|view)/|ui/)" },
    },
    {
      name: "core-does-not-know-host-or-render",
      severity: "error",
      comment:
        "Core owns domain state and decisions. It may emit view models, but must not import host adapters, renderers, runtime orchestration, or UI shell code.",
      from: { path: "^src/core/" },
      to: { path: "^(src/(host|render|runtime)/|ui/)" },
    },
    {
      name: "host-stays-at-boundary",
      severity: "error",
      comment:
        "Host adapters translate commands and surfaces only. They may use core boundary types, but not core behavior or renderers.",
      from: { path: "^src/host/" },
      to: { path: "^(src/core/(core|pattern|track|transport)\\.ts$|src/(render|runtime)/|ui/)" },
    },
    {
      name: "host-does-not-interpret-controls",
      severity: "error",
      comment: "Host adapters parse Move input into control input but do not interpret controls or apply domain intents.",
      from: { path: "^src/host/" },
      to: { path: "^src/core/(controls/(?!types\\.ts$)|intents/)" },
    },
    {
      name: "render-stays-presentational",
      severity: "error",
      comment:
        "Renderers consume view types and surfaces. They must not import host adapters or core behavior modules.",
      from: { path: "^src/render/" },
      to: { path: "^(src/(host|runtime)/|src/core/(core|pattern|track|transport)\\.ts$|ui/)" },
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
      name: "runtime-does-not-interpret-controls",
      severity: "error",
      comment: "Runtime passes parsed input to core; core owns control interpretation and intent application.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/core/(controls/|intents/)" },
    },
    {
      name: "core-controls-only-emit-intent-types",
      severity: "error",
      comment: "Control interpretation may emit domain intent types but must not apply domain intents.",
      from: { path: "^src/core/controls/" },
      to: { path: "^src/core/intents/(?!types\\.ts$)" },
    },
    {
      name: "core-intents-do-not-know-controls",
      severity: "error",
      comment: "Domain intent application owns domain mutations and must not depend back on control-shaped input.",
      from: { path: "^src/core/intents/" },
      to: { path: "^src/core/controls/" },
    },
    {
      name: "playback-internals-stay-private",
      severity: "error",
      comment:
        "Playback exposes lifecycle verbs through src/core/playback; low-level Playing Clip, Queued Clip, and note-off helpers stay module-private.",
      from: { pathNot: "^src/core/playback/" },
      to: { path: "^src/core/playback/internal/" },
    },
    {
      name: "project-internals-stay-private",
      severity: "error",
      comment:
        "Project exposes construction and cell lookup through src/core/project; low-level project structure helpers stay module-private.",
      from: { pathNot: "^src/core/project/" },
      to: { path: "^src/core/project/internal/" },
    },
    {
      name: "view-stays-on-snapshot-contracts",
      severity: "error",
      comment:
        "View derives semantic models from core snapshot contracts, not core behavior or host/runtime/render integration.",
      from: { path: "^src/view/" },
      to: { path: "^(src/(core/(?!types\\.ts$)|host|ports|render|runtime)/|ui/)" },
    },
    {
      name: "view-does-not-use-input-pipeline",
      severity: "error",
      comment: "View derives display models only; it must not participate in control interpretation or intent application.",
      from: { path: "^src/view/" },
      to: { path: "^src/core/(controls/|intents/)" },
    },
    {
      name: "ports-stay-contracts",
      severity: "error",
      comment: "Port contracts may reference core types, but not core behavior, host adapters, renderers, runtime orchestration, or UI shell code.",
      from: { path: "^src/ports/" },
      to: { path: "^(src/core/(core|pattern|track|transport)\\.ts$|src/(host|render|runtime|view)/|ui/)" },
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

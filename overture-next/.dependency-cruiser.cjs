/**
 * dependency-cruiser config for Overture Next.
 *
 * This is an evolutionary-architecture ratchet: every `error` rule describes a
 * boundary that is already true and must not regress. Add new rules as `warn`
 * only when they describe known, counted debt; promote them to `error` once the
 * count reaches zero.
 */
const {
  createInternalPrivacyRules,
  createPublicApiRules,
} = require("./scripts/internal-privacy-rules.cjs");

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
      comment:
        "Shared Session grid geometry is pure coordinate math and must not depend on application layers.",
      from: { path: "^src/shared/session-grid\\.ts$" },
      to: {
        path: "^(src/(application|domain|state|host|ports|render|runtime|view)/|ui/)",
      },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment:
        "Domain owns durable musical model and must not depend on state, application, adapters, renderers, runtime orchestration, or UI shell code.",
      from: { path: "^src/domain/" },
      to: {
        path: "^(src/(application|state|host|ports|render|runtime|view)/|ui/)",
      },
    },
    {
      name: "domain-does-not-import-session-grid",
      severity: "error",
      comment:
        "Session grid geometry is surface addressing; pure domain modules must not depend on it through shared.",
      from: { path: "^src/domain/" },
      to: { path: "^src/shared/session-grid\\.ts$" },
    },
    {
      name: "state-does-not-import-application-or-adapters",
      severity: "error",
      comment:
        "State owners may depend on domain and shared contracts, but must not depend upward on application behavior or adapters.",
      from: { path: "^src/state/" },
      to: { path: "^(src/(application|host|ports|render|runtime|view)/|ui/)" },
    },
    {
      name: "application-does-not-know-adapters-or-renderers",
      severity: "error",
      comment:
        "Application orchestration may use domain, state, and shared modules, but not host adapters, ports, renderers, runtime orchestration, view projection, or UI shell code.",
      from: { path: "^src/application/" },
      to: { path: "^(src/(host|ports|render|runtime|view)/|ui/)" },
    },
    {
      name: "host-stays-at-boundary",
      severity: "error",
      comment:
        "Host adapters translate commands and surfaces only. They may use application boundary types, but not application behavior or renderers.",
      from: { path: "^src/host/" },
      to: {
        path: "^(src/application/(core|transport|playback|controls/(?!types\\.ts$)|intents/)|src/(render|runtime)/|ui/)",
      },
    },
    {
      name: "host-does-not-interpret-controls",
      severity: "error",
      comment:
        "Host adapters parse Move input into control input but do not interpret controls or apply domain intents.",
      from: { path: "^src/host/" },
      to: { path: "^src/application/(controls/(?!types\\.ts$)|intents/)" },
    },
    {
      name: "render-stays-presentational",
      severity: "error",
      comment:
        "Renderers consume view types and surfaces. They must not import host adapters or application behavior modules.",
      from: { path: "^src/render/" },
      to: {
        path: "^(src/(host|runtime)/|src/application/(core|transport|playback|controls|intents)/|ui/)",
      },
    },
    {
      name: "runtime-owns-orchestration",
      severity: "error",
      comment:
        "Runtime coordinates core, renderers, and host ports; lower layers must not import runtime modules.",
      from: {
        path: "^src/(application|domain|state|host|ports|render|view|shared)/",
      },
      to: { path: "^src/runtime/" },
    },
    {
      name: "runtime-uses-ports",
      severity: "error",
      comment:
        "Runtime depends on port contracts, not concrete host adapters or host compatibility types.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/host/" },
    },
    {
      name: "runtime-does-not-interpret-controls",
      severity: "error",
      comment:
        "Runtime passes parsed input to application orchestration; runtime does not interpret controls.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/application/(controls/|intents/)" },
    },
    {
      name: "application-controls-only-emit-intent-types",
      severity: "error",
      comment:
        "Control interpretation may emit domain intent types but must not apply domain intents.",
      from: { path: "^src/application/controls/" },
      to: { path: "^src/application/intents/(?!types\\.ts$)" },
    },
    {
      name: "control-state-owns-state-contract",
      severity: "error",
      comment:
        "Control State owns its state contract and must not depend on the control input interpreter package.",
      from: { path: "^src/state/control-state\\.ts$" },
      to: { path: "^src/application/controls/" },
    },
    {
      name: "application-intents-do-not-know-controls",
      severity: "error",
      comment:
        "Domain intent application owns domain mutations and must not depend back on control-shaped input.",
      from: { path: "^src/application/intents/" },
      to: { path: "^src/application/controls/" },
    },
    ...createInternalPrivacyRules({ rootDir: __dirname, sourceDir: "src" }),
    ...createPublicApiRules({ rootDir: __dirname, sourceDir: "src" }),
    {
      name: "playback-does-not-own-transport",
      severity: "error",
      comment:
        "Transport owns TransportState mutation; playback consumes read-only timing data and must not import transport behavior.",
      from: { path: "^src/application/playback/" },
      to: { path: "^src/application/transport\\.ts$" },
    },
    {
      name: "view-stays-on-snapshot-contracts",
      severity: "error",
      comment:
        "View derives semantic models from application snapshot contracts, not application behavior or host/runtime/render integration.",
      from: { path: "^src/view/" },
      to: {
        path: "^(src/(application/(?!types\\.ts$)|host|ports|render|runtime)/|ui/)",
      },
    },
    {
      name: "view-does-not-use-input-pipeline",
      severity: "error",
      comment:
        "View derives display models only; it must not participate in control interpretation or intent application.",
      from: { path: "^src/view/" },
      to: { path: "^src/application/(controls/|intents/)" },
    },
    {
      name: "ports-stay-contracts",
      severity: "error",
      comment:
        "Port contracts may reference application boundary types, but not application behavior, host adapters, renderers, runtime orchestration, or UI shell code.",
      from: { path: "^src/ports/" },
      to: {
        path: "^(src/application/(core|transport|playback|controls/(?!types\\.ts$)|intents/)|src/(host|render|runtime|view)/|ui/)",
      },
    },
    {
      name: "no-next-imports-legacy-ui",
      severity: "error",
      comment:
        "Overture Next must not depend on the legacy dAVEBOx-derived UI implementation.",
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

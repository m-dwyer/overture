import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createInternalPrivacyRules, createPublicApiRules, discoverInternalModules } = require("./internal-privacy-rules.cjs");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "overture-internal-rules-"));

fs.mkdirSync(path.join(fixtureRoot, "src/core/project/internal"), { recursive: true });
fs.mkdirSync(path.join(fixtureRoot, "src/view/internal"), { recursive: true });
fs.mkdirSync(path.join(fixtureRoot, "src/view/session/internal"), { recursive: true });

const rules = createInternalPrivacyRules({ rootDir: fixtureRoot, sourceDir: "src" });
const publicApiRules = createPublicApiRules({ rootDir: fixtureRoot, sourceDir: "src" });
const modules = discoverInternalModules({ rootDir: fixtureRoot, sourceDir: "src" });

assert.deepEqual(
  rules.map((rule) => rule.name),
  ["core-project-internals-stay-private", "view-internals-stay-private", "view-session-internals-stay-private"],
);

assert.deepEqual(
  rules.map((rule) => ({ from: rule.from, to: rule.to })),
  [
    { from: { pathNot: "^src/core/project/" }, to: { path: "^src/core/project/internal/" } },
    { from: { pathNot: "^src/view/" }, to: { path: "^src/view/internal/" } },
    { from: { pathNot: "^src/view/session/" }, to: { path: "^src/view/session/internal/" } },
  ],
);

assert.deepEqual(
  modules.map((internalModule) => ({
    ownerPath: internalModule.ownerPath,
    hasIndex: internalModule.hasIndex,
  })),
  [
    { ownerPath: "core/project", hasIndex: false },
    { ownerPath: "view", hasIndex: false },
    { ownerPath: "view/session", hasIndex: false },
  ],
);

fs.writeFileSync(path.join(fixtureRoot, "src/view/index.ts"), "");
fs.writeFileSync(path.join(fixtureRoot, "src/view/session/index.ts"), "");

assert.deepEqual(createPublicApiRules({ rootDir: fixtureRoot, sourceDir: "src" }), [
  {
    name: "view-public-api-only",
    severity: "error",
    comment: "Code outside src/view/ imports its public entry point, not implementation files.",
    from: { pathNot: "^src/view/" },
    to: { path: "^src/view/(?!(?:index\\.ts|session/index\\.ts)$)" },
  },
  {
    name: "view-session-public-api-only",
    severity: "error",
    comment: "Code outside src/view/session/ imports its public entry point, not implementation files.",
    from: { pathNot: "^src/view/session/" },
    to: { path: "^src/view/session/(?!(?:index\\.ts)$)" },
  },
]);

assert.deepEqual(publicApiRules, []);

const fs = require("node:fs");
const path = require("node:path");

function createInternalPrivacyRules({ rootDir, sourceDir }) {
  return discoverInternalModules({ rootDir, sourceDir })
    .map((internalModule) =>
      createInternalPrivacyRule(internalModule, sourceDir),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createPublicApiRules({ rootDir, sourceDir }) {
  const internalModules = discoverInternalModules({ rootDir, sourceDir });
  return internalModules
    .filter((internalModule) => internalModule.hasIndex)
    .map((internalModule) =>
      createPublicApiRule(internalModule, internalModules),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function discoverInternalModules({ rootDir, sourceDir }) {
  const sourceRoot = path.join(rootDir, sourceDir);
  return discoverInternalDirectories(sourceRoot).map((internalDir) => {
    const ownerDir = path.dirname(internalDir);
    const ownerPath = toPosix(path.relative(sourceRoot, ownerDir));
    return {
      ownerDir,
      ownerPath,
      ownerPrefix: ownerPath ? `${sourceDir}/${ownerPath}/` : `${sourceDir}/`,
      internalPrefix: ownerPath
        ? `${sourceDir}/${ownerPath}/internal/`
        : `${sourceDir}/internal/`,
      hasIndex: fs.existsSync(path.join(ownerDir, "index.ts")),
    };
  });
}

function discoverInternalDirectories(rootDir) {
  const internalDirs = [];
  visit(rootDir);
  return internalDirs;

  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const childDir = path.join(dir, entry.name);
      if (entry.name === "internal") {
        internalDirs.push(childDir);
        continue;
      }

      visit(childDir);
    }
  }
}

function createInternalPrivacyRule({ ownerPath, ownerPrefix, internalPrefix }) {
  return {
    name: ownerPath
      ? `${ownerPath.replaceAll("/", "-")}-internals-stay-private`
      : "source-internals-stay-private",
    severity: "error",
    comment: `The ${internalPrefix} directory is private to ${ownerPrefix}.`,
    from: { pathNot: `^${escapeRegExp(ownerPrefix)}` },
    to: { path: `^${escapeRegExp(internalPrefix)}` },
  };
}

function createPublicApiRule(internalModule, internalModules) {
  const { ownerPath, ownerPrefix } = internalModule;
  const allowedPublicEntries = [
    "index.ts",
    ...nestedPublicEntryPaths(internalModule, internalModules),
  ];
  const allowedPattern = allowedPublicEntries.map(escapeRegExp).join("|");
  return {
    name: ownerPath
      ? `${ownerPath.replaceAll("/", "-")}-public-api-only`
      : "source-public-api-only",
    severity: "error",
    comment: `Code outside ${ownerPrefix} imports its public entry point, not implementation files.`,
    from: { pathNot: `^${escapeRegExp(ownerPrefix)}` },
    to: { path: `^${escapeRegExp(ownerPrefix)}(?!(?:${allowedPattern})$)` },
  };
}

function nestedPublicEntryPaths(internalModule, internalModules) {
  const nestedPrefix = internalModule.ownerPath
    ? `${internalModule.ownerPath}/`
    : "";
  return internalModules
    .filter(
      (candidate) =>
        candidate.hasIndex &&
        candidate.ownerPath.startsWith(nestedPrefix) &&
        candidate.ownerPath !== internalModule.ownerPath,
    )
    .map(
      (candidate) =>
        `${candidate.ownerPath.slice(nestedPrefix.length)}/index.ts`,
    );
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  createInternalPrivacyRules,
  createPublicApiRules,
  discoverInternalModules,
};

if (require.main === module) {
  const options = { rootDir: path.join(__dirname, ".."), sourceDir: "src" };
  console.log(
    JSON.stringify(
      [
        ...createInternalPrivacyRules(options),
        ...createPublicApiRules(options),
      ],
      null,
      2,
    ),
  );
}

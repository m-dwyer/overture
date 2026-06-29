import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { discoverInternalModules } = require("./internal-privacy-rules.cjs");

const rootDir = path.join(new URL("../", import.meta.url).pathname);
const modules = discoverInternalModules({ rootDir, sourceDir: "src" });
const failures = [];

for (const internalModule of modules) {
  if (!internalModule.hasIndex) {
    failures.push(
      `${internalModule.ownerPrefix} has internal/ but no index.ts public entry point`,
    );
  }

  if (!hasMatchingTest(internalModule.ownerPath)) {
    failures.push(
      `${internalModule.ownerPrefix} has internal/ but no matching tests/${internalModule.ownerPath} test`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

function hasMatchingTest(ownerPath) {
  const directTest = path.join(rootDir, "tests", `${ownerPath}.test.ts`);
  if (fs.existsSync(directTest)) return true;

  const testDir = path.join(rootDir, "tests", ownerPath);
  return fs.existsSync(testDir) && hasTestFile(testDir);
}

function hasTestFile(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && hasTestFile(entryPath)) return true;
    if (entry.isFile() && entry.name.endsWith(".test.ts")) return true;
  }
  return false;
}

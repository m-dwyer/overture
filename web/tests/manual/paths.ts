import path from "node:path";

// Output locations for the generated beginner guide. Playwright runs with cwd =
// web/, so REPO_ROOT resolves to the overture/ repo root.
export const REPO_ROOT = path.resolve(process.cwd(), "..");
export const OUT_DIR = path.join(REPO_ROOT, "docs/generated");
export const ASSET_DIR = path.join(OUT_DIR, "assets");

// Beginner guide (scenarios.ts → content.ts).
export const GUIDE_PATH = path.join(OUT_DIR, "overture-beginner-guide.md");
export const HTML_PATH = path.join(OUT_DIR, "overture-beginner-guide.html");

// Full reference manual (reference.ts → reference-content.ts). Shares ASSET_DIR;
// reference figures use a `ref-` filename prefix so they never collide.
export const REF_GUIDE_PATH = path.join(OUT_DIR, "overture-reference.md");
export const REF_HTML_PATH = path.join(OUT_DIR, "overture-reference.html");

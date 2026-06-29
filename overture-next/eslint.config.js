import tseslint from "typescript-eslint";
import stateApiEncapsulation from "./eslint-rules/state-api-encapsulation.js";
import stateOwnership from "./eslint-rules/state-ownership.js";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      overture: {
        rules: {
          "state-api-encapsulation": stateApiEncapsulation,
          "state-ownership": stateOwnership,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression TSAsExpression",
          message:
            "Avoid double type assertions such as `as unknown as`; model the type or add a typed helper.",
        },
      ],
      "overture/state-ownership": [
        "error",
        {
          owners: [
            { type: "TransportState", allow: ["src/application/transport.ts"] },
            { type: "PlaybackState", allow: ["src/application/playback/**"] },
            {
              type: "ControlSurfaceContext",
              allow: ["src/state/control-surface-context.ts"],
            },
            { type: "OvertureProject", allow: ["src/state/project.ts"] },
          ],
        },
      ],
      "overture/state-api-encapsulation": [
        "error",
        {
          owners: [
            { type: "ControlSurfaceContext" },
            { type: "TransportState" },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../src/**/internal/*",
                "../../src/**/internal/*",
                "../../../src/**/internal/*",
              ],
              message:
                "Tests should exercise module contracts through public entry points, not internal helpers.",
            },
            {
              group: [
                "../src/application/playback/*",
                "../../src/application/playback/*",
                "../../../src/application/playback/*",
              ],
              message: "Import Playback through its public module entry point.",
            },
            {
              group: [
                "../src/state/project/*",
                "../../src/state/project/*",
                "../../../src/state/project/*",
              ],
              message: "Import Project through its public module entry point.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message:
            "Overture package tests should live under a layer/module directory such as tests/core, tests/runtime, tests/render, tests/host, or tests/view.",
        },
      ],
    },
  },
);

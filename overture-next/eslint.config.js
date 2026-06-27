import tseslint from "typescript-eslint";
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
            { type: "TransportState", allow: ["src/core/transport.ts"] },
            { type: "PlaybackState", allow: ["src/core/playback/**"] },
            { type: "ControlState", allow: ["src/core/control-state.ts"] },
            { type: "OvertureProject", allow: ["src/core/project/**"] },
          ],
        },
      ],
    },
  },
);

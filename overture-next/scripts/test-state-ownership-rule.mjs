import { RuleTester } from "@typescript-eslint/rule-tester";
import tseslint from "typescript-eslint";
import stateOwnership from "../eslint-rules/state-ownership.js";

RuleTester.afterAll = () => {};
RuleTester.describe = (_name, run) => run();
RuleTester.it = (_name, run) => run();

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      projectService: { allowDefaultProject: ["rule-tests/*.ts"] },
      tsconfigRootDir: new URL("../", import.meta.url).pathname,
    },
  },
});

ruleTester.run("state-ownership", stateOwnership, {
  valid: [
    {
      filename: "rule-tests/transport.ts",
      code: `
        interface TransportState {
          playing: boolean;
        }
        export function ok(transport: TransportState): void {
          transport.playing = false;
        }
      `,
      options: [{ owners: [{ type: "TransportState", allow: ["rule-tests/transport.ts"] }] }],
    },
  ],
  invalid: [
    {
      filename: "rule-tests/core.ts",
      code: `
        interface TransportState {
          playing: boolean;
        }
        export function bad(transport: TransportState): void {
          transport.playing = false;
        }
      `,
      options: [{ owners: [{ type: "TransportState", allow: ["rule-tests/transport.ts"] }] }],
      errors: [{ messageId: "ownedStateMutation" }],
    },
    {
      filename: "rule-tests/core.ts",
      code: `
        interface ScheduledNoteOff {
          dueTick: number;
        }
        interface PlaybackState {
          pendingNoteOffs: ScheduledNoteOff[];
        }
        export function bad(playback: PlaybackState): void {
          playback.pendingNoteOffs.push({ dueTick: 1 });
        }
      `,
      options: [{ owners: [{ type: "PlaybackState", allow: ["rule-tests/playback/**"] }] }],
      errors: [{ messageId: "ownedStateMutation" }],
    },
  ],
});

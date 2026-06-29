import { RuleTester } from "@typescript-eslint/rule-tester";
import tseslint from "typescript-eslint";
import stateApiEncapsulation from "../eslint-rules/state-api-encapsulation.js";
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

ruleTester.run("state-api-encapsulation", stateApiEncapsulation, {
  valid: [
    {
      filename: "rule-tests/control-surface-context.ts",
      code: `
        class ControlSurfaceContext {
          selectStep(stepIndex: number): void {}
        }
        export function createControlSurfaceContext(): ControlSurfaceContext {
          return new ControlSurfaceContext();
        }
      `,
      options: [{ owners: [{ type: "ControlSurfaceContext" }] }],
    },
    {
      filename: "rule-tests/interpret-control.ts",
      code: `
        interface ControlSurfaceContextSnapshot {
          selectedStep: number;
        }
        export function selectedStep(snapshot: ControlSurfaceContextSnapshot): number {
          return snapshot.selectedStep;
        }
      `,
      options: [{ owners: [{ type: "ControlSurfaceContext" }] }],
    },
    {
      filename: "rule-tests/transport.ts",
      code: `
        class TransportState {
          start(): void {}
        }
        export function createTransport(): TransportState {
          return new TransportState();
        }
      `,
      options: [{ owners: [{ type: "TransportState" }] }],
    },
  ],
  invalid: [
    {
      filename: "rule-tests/control-surface-context.ts",
      code: `
        class ControlSurfaceContext {
          selectStep(stepIndex: number): void {}
        }
        export function selectStep(control: ControlSurfaceContext, stepIndex: number): void {
          control.selectStep(stepIndex);
        }
      `,
      options: [{ owners: [{ type: "ControlSurfaceContext" }] }],
      errors: [{ messageId: "exportedOwnedStateParameter" }],
    },
    {
      filename: "rule-tests/control-surface-context.ts",
      code: `
        class ControlSurfaceContext {
          selectStep(stepIndex: number): void {}
        }
        export const selectStep = (control: ControlSurfaceContext, stepIndex: number): void => {
          control.selectStep(stepIndex);
        };
      `,
      options: [{ owners: [{ type: "ControlSurfaceContext" }] }],
      errors: [{ messageId: "exportedOwnedStateParameter" }],
    },
    {
      filename: "rule-tests/transport.ts",
      code: `
        class TransportState {
          start(): void {}
        }
        export function startTransport(transport: TransportState): void {
          transport.start();
        }
      `,
      options: [{ owners: [{ type: "TransportState" }] }],
      errors: [{ messageId: "exportedOwnedStateParameter" }],
    },
  ],
});

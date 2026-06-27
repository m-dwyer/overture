import { ESLint } from "eslint";

const cwd = new URL("../", import.meta.url).pathname;
const eslint = new ESLint({ cwd });

const cases = [
  {
    name: "rejects transport mutation outside the transport owner",
    filePath: "src/core/core.ts",
    code: `
      import type { TransportState } from "./transport";
      export function bad(transport: TransportState): void {
        transport.playing = false;
      }
    `,
    expectStateOwnershipError: true,
  },
  {
    name: "allows transport mutation inside the transport owner",
    filePath: "src/core/transport.ts",
    code: `
      import type { TransportState } from "./transport";
      export function ok(transport: TransportState): void {
        transport.playing = false;
      }
    `,
    expectStateOwnershipError: false,
  },
  {
    name: "rejects playback array mutation outside the playback owner",
    filePath: "src/core/core.ts",
    code: `
      import type { PlaybackState } from "./playback";
      export function bad(playback: PlaybackState): void {
        playback.pendingNoteOffs.push({
          dueTick: 1,
          note: 60,
          route: { kind: "move", moveTrackTarget: 0 },
          trackIndex: 0,
        });
      }
    `,
    expectStateOwnershipError: true,
  },
];

let failed = false;
for (const testCase of cases) {
  const [result] = await eslint.lintText(testCase.code, {
    filePath: new URL("../" + testCase.filePath, import.meta.url).pathname,
  });
  const hasStateOwnershipError = result.messages.some((message) => message.ruleId === "overture/state-ownership");
  if (hasStateOwnershipError !== testCase.expectStateOwnershipError) {
    failed = true;
    console.error("state-ownership rule test failed:", testCase.name);
    console.error(result.messages.map(({ ruleId, message }) => ({ ruleId, message })));
  }
}

if (failed) process.exit(1);

import { describe, expect, test } from "vitest";
import { DEFAULT_STEP_COUNT } from "../../src/domain/sequence";
import { createTransport } from "../../src/application/transport";

describe("Overture Next transport", () => {
  test("starts and stops clock state without changing playhead position", () => {
    const transport = createTransport();

    transport.seekToStep(4);
    transport.start();
    expect(transport.snapshot()).toMatchObject({
      playing: true,
      tick: 0,
      playhead: 4,
    });

    transport.stop();
    expect(transport.snapshot()).toMatchObject({
      playing: false,
      tick: 0,
      playhead: 4,
    });
  });

  test("advances ticks and reports injected steps only at step boundaries", () => {
    const transport = createTransport(3);

    expect(transport.advance(DEFAULT_STEP_COUNT)).toEqual({
      injectedStep: null,
      tick: 0,
    });

    transport.start();
    expect(transport.advance(DEFAULT_STEP_COUNT)).toEqual({
      injectedStep: null,
      tick: 1,
    });
    expect(transport.advance(DEFAULT_STEP_COUNT)).toEqual({
      injectedStep: null,
      tick: 2,
    });
    expect(transport.advance(DEFAULT_STEP_COUNT)).toEqual({
      injectedStep: 1,
      tick: 3,
    });
    expect(transport.clock()).toEqual({ playhead: 1, tick: 3 });
  });
});

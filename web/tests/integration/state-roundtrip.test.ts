import { describe, test, expect, beforeAll } from "vitest";
import { createHarness, type Harness } from "./harness.js";

describe("seq8 state round-trip guards (real seq8-wasm)", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  const get = (key: string): string => {
    const val = h.get(key);
    expect(val, key).not.toBeNull();
    return val as string;
  };

  test("save + state_load restores melodic clip, drum lane, and pfx state", () => {
    h.set("t1_c0_step_3_add", "64 2 111 67 -1 96");
    h.set("t1_c0_step_3_gate", "37");
    h.set("t1_c0_step_3_iter", "35");
    h.set("t1_c0_step_3_rand", "73");
    h.set("t1_c0_step_3_ratch", "3");
    h.set("t1_c0_pfx_set", "noteFX_gate 142");
    h.set("t1_c0_pfx_set", "noteFX_velocity -9");
    h.set("t1_c0_pfx_set", "seq_arp_style 4");
    h.set("t1_c0_pfx_set", "seq_arp_rate 5");
    h.set("t1_c0_pfx_set", "seq_arp_step_vel 2 1");
    h.set("t1_c0_pfx_set", "seq_arp_step_int 2 -3");
    h.set("t1_c0_pfx_set", "seq_arp_step_loop_len 5");

    h.set("t0_l0_step_5_toggle", "104");
    h.set("t0_l0_step_5_gate", "31");
    h.set("t0_l0_step_5_nudge", "4");
    h.set("t0_l0_repeat_gate_and_len", "173 5");
    h.set("t0_l0_pfx_set", "noteFX_gate 88");
    h.set("t0_l0_pfx_set", "delay_level 47");
    h.set("t0_l0_pfx_set", "delay_retrig 0");

    const expected = {
      melodicSteps: get("t1_c0_steps"),
      melodicNotes: get("t1_c0_step_3_notes"),
      melodicVel: get("t1_c0_step_3_vel"),
      melodicGate: get("t1_c0_step_3_gate"),
      melodicNudge: get("t1_c0_step_3_nudge"),
      melodicIter: get("t1_c0_step_3_iter"),
      melodicRand: get("t1_c0_step_3_rand"),
      melodicRatch: get("t1_c0_step_3_ratch"),
      melodicPfx: get("t1_c0_pfx_snapshot"),
      drumSteps: get("t0_l0_steps"),
      drumVel: get("t0_l0_step_5_vel"),
      drumGate: get("t0_l0_step_5_gate"),
      drumNudge: get("t0_l0_step_5_nudge"),
      drumRepeat: get("t0_l0_repeat_state"),
      drumPfx: get("t0_l0_pfx_snapshot"),
    };

    h.set("save", "1");

    h.set("t1_c0_step_3_clear", "1");
    h.set("t1_c0_pfx_set", "pfx_reset 1");
    h.set("t0_l0_step_5_clear", "1");
    h.set("t0_l0_repeat_gate_and_len", "255 8");
    h.set("t0_l0_pfx_reset", "1");
    expect(get("t1_c0_steps")).not.toBe(expected.melodicSteps);
    expect(get("t0_l0_steps")).not.toBe(expected.drumSteps);

    h.set("state_load", "");

    expect(get("t1_c0_steps")).toBe(expected.melodicSteps);
    expect(get("t1_c0_step_3_notes")).toBe(expected.melodicNotes);
    expect(get("t1_c0_step_3_vel")).toBe(expected.melodicVel);
    expect(get("t1_c0_step_3_gate")).toBe(expected.melodicGate);
    expect(get("t1_c0_step_3_nudge")).toBe(expected.melodicNudge);
    expect(get("t1_c0_step_3_iter")).toBe(expected.melodicIter);
    expect(get("t1_c0_step_3_rand")).toBe(expected.melodicRand);
    expect(get("t1_c0_step_3_ratch")).toBe(expected.melodicRatch);
    expect(get("t1_c0_pfx_snapshot")).toBe(expected.melodicPfx);
    expect(get("t0_l0_steps")).toBe(expected.drumSteps);
    expect(get("t0_l0_step_5_vel")).toBe(expected.drumVel);
    expect(get("t0_l0_step_5_gate")).toBe(expected.drumGate);
    expect(get("t0_l0_step_5_nudge")).toBe(expected.drumNudge);
    expect(get("t0_l0_repeat_state")).toBe(expected.drumRepeat);
    expect(get("t0_l0_pfx_snapshot")).toBe(expected.drumPfx);
  });
});

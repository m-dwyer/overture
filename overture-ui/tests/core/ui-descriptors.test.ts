import { describe, beforeEach, test, expect } from "vitest";
import { S } from "@overture-ui/core/ui_state.mjs";
import { describeEditSoundForTrack, matchingSchwungSlotMask, routeScopeShortLabel } from "@overture-ui/core/ui_routes.mjs";
import { routeCheckStatus, routeCheckViewModel } from "@overture-ui/core/ui_route_check.mjs";
import { PARAM_PEEK_DETAIL_TICKS, autoLaneLabel, motionIdleModel, motionOverviewModel, paramPeekInfo } from "@overture-ui/motion/ui_motion_model.mjs";
import { allLanesParameterPageGridModel, drumLaneParameterPageGridModel, drumMidiDelayParameterPageGridModel, drumNoteFxParameterPageModel, drumRepeatGrooveParameterPageModel, genericParameterPageGridModel, labelValueParameterPageGridModel, melodicNoteFxParameterPageGridModel, parameterPageFeedbackPolicy, trackBankOverviewRoute } from "@overture-ui/core/ui_parameter_page_model.mjs";
import { fmtArpRate } from "@overture-ui/core/ui_constants.mjs";

describe("UI descriptor seams", () => {
  beforeEach(() => {
    S.activeTrack = 0;
    S.activeBank = 6;
    S.bankParams = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => new Array(8).fill(0))
    );
    S.playing = false;
    S.tickCount = 100;
    S.knobTouched = 1;
    S.knobTouchStartTick = 100;
    S.altMode = false;
    S.pendingEditSoundEntry = null;
    S.schwungSoundPage = null;
    S.schwungSoundMemory = Array.from({ length: 8 }, () => ({ selectedIndex: 1, paramDetailIndex: 0, paramDetail: true }));
    S._coRunChanSlots = 0;
    S.trackRoute[0] = 1;
    S.trackChannel[0] = 1;
    S.trackRoute[4] = 0;
    S.trackChannel[4] = 5;
    for (let t = 1; t < 8; t++) {
      S.trackRoute[t] = t < 4 ? 1 : 0;
      S.trackChannel[t] = t + 1;
    }
    S.trackPadMode[0] = 0;
    S.trackActiveClip[0] = 0;
    S.activeDrumLane[0] = 2;
    S.drumLaneNote[0][2] = 48;
    S.drumLaneQnt[0] = 37;
    S.drumLaneLenMode[0][2] = 5;
    S.trackQueuedClip[0] = -1;
    S.ccActiveLane[0] = 1;
    S.trackCCType[0] = [1, 0, 2, 0, 0, 0, 0, 0];
    S.trackCCAssign[0] = [7, 74, 5, -1, 72, 91, 93, 10];
    S.schLabel[0] = [null, null, "Cutoff", null, null, null, null, null];
    S.trackCCAutoBits[0][0] = 0b00000101;
    S.clipAtHas[0][0] = true;
    S.clipCCVal[0][0][1] = 64;
    S.clipCCVal[0][0][2] = 99;
    S.clipLength[0][0] = 16;
    S.clipTPS[0][0] = 24;
    S.ccLaneLength[0][0][1] = 0;
    S.ccLaneTps[0][0][1] = 0;
    S.ccLaneResTps[0][0][1] = 0;
    Reflect.set(globalThis, "shadow_get_slots", () => [
      { channel: 5, name: "Slot1" },
      { channel: 6, name: "Slot2" },
      { channel: 0, name: "Layer" },
    ]);
    Reflect.deleteProperty(globalThis, "host_list_modules");
    Reflect.deleteProperty(globalThis, "shadow_get_param");
    Reflect.deleteProperty(globalThis, "shadow_set_param");
    Reflect.deleteProperty(globalThis, "shadow_list_modules_for_component");
    Reflect.deleteProperty(globalThis, "host_ensure_dir");
    Reflect.deleteProperty(globalThis, "host_pad_block");
    Reflect.deleteProperty(globalThis, "host_read_file");
    Reflect.deleteProperty(globalThis, "host_write_file");
  });

  test("Schwung slot masks include exact-channel and All-channel slots", () => {
    expect(matchingSchwungSlotMask(5, [
      { channel: 5 },
      { channel: 6 },
      { channel: 0 },
      { channel: 5 },
    ])).toBe(0b1101);
  });

  test("Edit Sound descriptor preserves Move and Schwung preflight cases", () => {
    expect(describeEditSoundForTrack(0, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "EDIT SOUND",
      body: "T1 Move Ch1",
      queue: { track: 0, route: 1, slot: -1 },
    });

    S.trackChannel[0] = 5;
    expect(describeEditSoundForTrack(0, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "MOVE CH>4",
      body: "Ch5",
      queue: { track: 0, route: 1, slot: -1 },
    });

    expect(describeEditSoundForTrack(4, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "EDIT SOUND",
      body: "T5 Schwung Slot1",
      queue: { track: 4, route: 0, slot: 0 },
      slotMask: 0b0101,
    });

    Reflect.set(globalThis, "shadow_get_slots", () => [{ channel: 6, name: "Slot2" }]);
    expect(describeEditSoundForTrack(4, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "NO SLOT",
      body: "Ch5",
      queue: { track: 4, route: 0, slot: -1 },
    });
  });

  test("route labels distinguish Move, External, Schwung slot, and Schwung channel fallback", () => {
    expect(routeScopeShortLabel(0)).toBe("Move Ch1");
    S.trackRoute[0] = 2;
    expect(routeScopeShortLabel(0)).toBe("Ext Ch1");
    S.trackRoute[0] = 0;
    S.trackChannel[0] = 5;
    expect(routeScopeShortLabel(0)).toBe("Schw S1");
    Reflect.set(globalThis, "shadow_get_slots", () => [{ channel: 8, name: "Slot4" }]);
    expect(routeScopeShortLabel(0)).toBe("Schw Ch5");
  });

  test("route check view model preserves windowing and row labels", () => {
    expect(routeCheckViewModel(0, globalThis.shadow_get_slots())).toEqual({
      title: "ROUTE CHECK",
      range: "1-4/9",
      footer: "Jog scroll  Back/Menu",
      rows: [
        { track: 0, text: "T1 Move Ch1", status: "MANUAL", active: true },
        { track: 1, text: "T2 Move Ch2", status: "MANUAL", active: false },
        { track: 2, text: "T3 Move Ch3", status: "MANUAL", active: false },
        { track: 3, text: "T4 Move Ch4", status: "MANUAL", active: false },
      ],
    });

    expect(routeCheckViewModel(5, globalThis.shadow_get_slots())).toMatchObject({
      range: "5-8/9",
      rows: [
        { track: 4, text: "T5 Schw Ch5", status: "OK S1", active: false },
        { track: 5, text: "T6 Schw Ch6", status: "OK S2", active: true },
        { track: 6, text: "T7 Schw Ch7", status: "OK S3", active: false },
        { track: 7, text: "T8 Schw Ch8", status: "OK S3", active: false },
      ],
    });
  });

  test("route check view model has a selectable Apply routing row at index 8", () => {
    // selected===8 scrolls the window to its bottom (indices 5-8) and highlights
    // the Apply routing action row; it carries no status and is not a track.
    const model = routeCheckViewModel(8, globalThis.shadow_get_slots());
    expect(model.range).toBe("6-9/9");
    expect(model.footer).toBe("Jog scroll  Back/Menu");
    expect(model.rows).toMatchObject([
      { track: 5, text: "T6 Schw Ch6", active: false },
      { track: 6, text: "T7 Schw Ch7", active: false },
      { track: 7, text: "T8 Schw Ch8", active: false },
      { track: -1, text: "Apply routing", status: "", active: true },
    ]);

    // selected stays clamped to the apply index (no 9th selectable beyond it).
    expect(routeCheckViewModel(9, globalThis.shadow_get_slots()).rows[3]).toMatchObject({
      text: "Apply routing",
      active: true,
    });
  });

  test("route check statuses preserve no-slot, thru, and mismatch warnings", () => {
    expect(routeCheckStatus(4, [{ channel: 6 }])).toBe("NO SLOT");
    expect(routeCheckStatus(4, [{ channel: -2, name: "Thru" }])).toBe("THRU!");

    S.trackRoute[0] = 0;
    expect(routeCheckStatus(0, [])).toBe("ROUTE!");

    S.trackRoute[0] = 1;
    S.trackChannel[0] = 9;
    expect(routeCheckStatus(0, [])).toBe("CH9!");

    S.trackChannel[5] = 16;
    expect(routeCheckStatus(5, [{ channel: 16 }])).toBe("OK S1");
  });

  test("motion descriptors preserve AUTO labels and Param Peek text", () => {
    expect(autoLaneLabel(0, 0, false)).toBe("AT");
    expect(autoLaneLabel(0, 1, true)).toBe("L2 CC74");
    expect(autoLaneLabel(0, 2, false)).toBe("Sch5");
    expect(autoLaneLabel(0, 3, false)).toBe("--");

    expect(paramPeekInfo()).toMatchObject({
      header: "AUTO T1 Clip A",
      target: "Move target",
      value: "Value 64",
      detail: "Clip A, Lane 2",
      route: "Route: Move Ch1",
    });

    S.ccLaneLength[0][0][1] = 32;
    S.ccLaneTps[0][0][1] = 12;
    S.ccLaneResTps[0][0][1] = 24;
    S.tickCount = PARAM_PEEK_DETAIL_TICKS;
    S.knobTouchStartTick = 0;
    expect(paramPeekInfo()).toMatchObject({
      header: "Move target",
      target: "Lane 2 / Clip A",
      value: "Route: Move Ch1",
      detail: "Loop 32 steps",
      route: "Res 1/16 Zoom 1/32",
    });
  });

  test("Param Peek describes drum NOTE FX controls from drum lane state", () => {
    S.trackPadMode[0] = 1;
    S.activeBank = 1;
    S.knobTouched = 0;
    S.bankParams[0][1][0] = 109;
    S.bankParams[0][1][1] = -7;

    expect(paramPeekInfo()).toMatchObject({
      header: "NOTE FX T1 Drum",
      target: "Lane Octave",
      value: "Value Note 48",
      detail: "Lane 3, octave jumps",
      route: "Route: Move Ch1",
    });

    S.knobTouched = 5;
    expect(paramPeekInfo()).toMatchObject({
      target: "Gate Time",
      value: "Value 109%",
      detail: "Lane 3",
    });
  });

  test("motion overview model preserves AUTO bank badges, lane cells, and footer", () => {
    expect(motionOverviewModel(0, 0)).toMatchObject({
      heading: "AUTO",
      badges: ["Sch", "AT", "CC"],
      footer: "",
    });
    expect(motionOverviewModel(0, 0).lanes.slice(0, 4)).toEqual([
      { lane: 0, label: "AT", value: "--", labelText: "AT  ", valueText: "--  ", touched: false, labelInverted: false, valueInverted: false },
      { lane: 1, label: "CC74", value: "64", labelText: "CC74", valueText: "64  ", touched: true, labelInverted: true, valueInverted: true },
      { lane: 2, label: "Sch5", value: "99", labelText: "Sch5", valueText: "99  ", touched: false, labelInverted: false, valueInverted: false },
      { lane: 3, label: "--", value: "--", labelText: "--  ", valueText: "--  ", touched: false, labelInverted: false, valueInverted: false },
    ]);
    S.knobTouched = 2;
    expect(motionOverviewModel(0, 0).footer).toBe("Cutoff");

    S.altMode = true;
    const assignModel = motionOverviewModel(0, 0);
    expect(assignModel.lanes[0]).toMatchObject({ labelInverted: true, valueInverted: false });
    expect(assignModel.lanes[1]).toMatchObject({ labelInverted: true, valueInverted: true });
  });

  test("motion idle model preserves active-lane summary text", () => {
    S.ccLaneLength[0][0][1] = 32;
    S.ccLaneTps[0][0][1] = 12;
    S.ccLaneResTps[0][0][1] = 24;

    expect(motionIdleModel(0, 0)).toEqual({
      heading: "AUTO",
      badges: ["Sch", "AT", "CC"],
      lane: 1,
      laneLabel: "L2 CC74",
      value: "64",
      valueUnderline: true,
      param: "",
      paramText: "",
      resText: "Res: 1/16",
      zoomText: "Zoom: 1/32",
      effectiveLength: 32,
      graphKey: "g_0_0_1",
      graphPages: 2,
    });

    S.ccActiveLane[0] = 2;
    expect(motionIdleModel(0, 0)).toMatchObject({
      laneLabel: "L3 Sch5",
      value: "99",
      param: "Cutoff",
      paramText: "Cutoff",
    });
  });

  test("generic Parameter Page model preserves cell formatting and slot assumptions", () => {
    const knobs = Array.from({ length: 8 }, (_, k) => ({
      abbrev: "K" + k,
      dspKey: "",
      fmt: (v: number) => "V" + v,
    }));
    knobs[1] = { abbrev: "Rate", dspKey: "", fmt: fmtArpRate };
    knobs[6] = { abbrev: "Dir", dspKey: "clip_playback_dir", fmt: (v: number) => "D" + v };
    knobs[7] = { abbrev: "Rnd", dspKey: "", fmt: (v: number) => "R" + v };

    const model = genericParameterPageGridModel({
      bank: 3,
      knobs,
      vals: [0, 2, 3, 4, 5, 6, 7, 8],
      altMode: true,
      isDrum: false,
      knobTouched: 6,
      midiDlyRandomMode: 1,
      noteFXRandomMode: 2,
      delayClockFb: -6,
      clipPlaybackAudioReverse: 1,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells[0]).toMatchObject({ label: "ClkF", value: "-6  ", highlighted: false });
    expect(model.cells[1]).toMatchObject({ label: "Rate", value: "1/16t", highlighted: false });
    expect(model.cells[6]).toMatchObject({ label: "Rvrs", value: "Audi", highlighted: true });
    expect(model.cells[7]).toMatchObject({ label: "Algo", value: "Gaus", highlighted: false });
  });

  test("label/value Parameter Page model preserves sparse slots and wide labels", () => {
    const model = labelValueParameterPageGridModel({
      labels: ["Res", "LongLabel", null, "Gate", "", "Dir", "SyncRpt", "-"],
      values: ["1/8", "96", "skip", 87, "skip", "Fwd", "ON", null],
      wideLabels: true,
      knobTouched: 6,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells).toHaveLength(8);
    expect(model.cells[0]).toMatchObject({ label: "Res ", value: "1/8 ", highlighted: false });
    expect(model.cells[1]).toMatchObject({ label: "LongLabel", value: "96  ", highlighted: false });
    expect(model.cells[2]).toBeNull();
    expect(model.cells[4]).toBeNull();
    expect(model.cells[6]).toMatchObject({ label: "SyncRpt", value: "ON  ", highlighted: true });
    expect(model.cells[7]).toMatchObject({ label: "-   ", value: "-   ", highlighted: false });
  });

  test("drum MIDI delay Parameter Page model preserves special-case cell labels", () => {
    const knobs = Array.from({ length: 8 }, (_, k) => ({
      abbrev: "K" + k,
      fmt: (v: number) => "V" + v,
    }));
    const model = drumMidiDelayParameterPageGridModel({
      knobs,
      vals: [2, 1, -3, 4, 5, -6, 1, 0],
      knobTouched: 5,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells[0]).toMatchObject({ label: "K0  ", value: "V2  ", highlighted: false });
    expect(model.cells[4]).toMatchObject({ label: "Gate", value: "1/8T", highlighted: false });
    expect(model.cells[5]).toMatchObject({ label: "Clk ", value: "-6  ", highlighted: true });
    expect(model.cells[6]).toMatchObject({ label: "Retr", value: "ON  ", highlighted: false });
    expect(model.cells[7]).toBeNull();
  });

  test("drum NOTE FX Parameter Page model preserves note block and sparse cells", () => {
    const model = drumNoteFxParameterPageModel({
      noteName: "C2",
      noteNumber: 48,
      velocity: -4,
      quantize: 55,
      lengthMode: 5,
      gate: 87,
      knobTouched: 1,
    });

    expect(model.noteBlock).toEqual({
      octaveLabel: "Oct",
      noteLabel: "Note",
      noteText: "C2 48",
      highlighted: true,
    });
    expect(model.cells).toHaveLength(8);
    expect(model.cells[0]).toBeNull();
    expect(model.cells[1]).toBeNull();
    expect(model.cells[2]).toMatchObject({ label: "Vel ", value: "-4  ", highlighted: false });
    expect(model.cells[3]).toMatchObject({ label: "Qnt ", value: "55% ", highlighted: false });
    expect(model.cells[4]).toMatchObject({ label: "Len>", value: "2   ", highlighted: false });
    expect(model.cells[5]).toMatchObject({ label: ">Gate", value: "87% ", highlighted: false });
    expect(model.cells[6]).toBeNull();
    expect(model.cells[7]).toBeNull();
  });

  test("drum lane Parameter Page model preserves lane cell labels and alt values", () => {
    const model = drumLaneParameterPageGridModel({
      altMode: true,
      tpsIdx: 2,
      stretch: -1,
      shift: 5,
      euclidN: 12,
      playbackDir: 3,
      playbackAudioReverse: 1,
      seqFollow: true,
      knobTouched: 6,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells[0]).toMatchObject({ label: "Zoom", value: "1/8 ", highlighted: false });
    expect(model.cells[1]).toMatchObject({ label: "Stch", value: "/2  ", highlighted: false });
    expect(model.cells[2]).toMatchObject({ label: "Nudg", value: "+5  ", highlighted: false });
    expect(model.cells[4]).toMatchObject({ label: "Eucl", value: "12  ", highlighted: false });
    expect(model.cells[6]).toMatchObject({ label: "Rvrs", value: "Audi", highlighted: true });
    expect(model.cells[7]).toMatchObject({ label: "SqFl", value: "ON  ", highlighted: false });
  });

  test("all lanes Parameter Page model preserves wide labels and unavailable values", () => {
    const model = allLanesParameterPageGridModel({
      altMode: true,
      resolution: -1,
      stretch: 1,
      shift: -2,
      quantize: 0,
      velocityOverride: 96,
      inputQuantize: 3,
      playbackDir: -1,
      syncRepeat: 1,
      knobTouched: 7,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells[0]).toMatchObject({ label: "Res ", value: "--  ", highlighted: false });
    expect(model.cells[2]).toMatchObject({ label: "Nudg", value: "-2  ", highlighted: false });
    expect(model.cells[3]).toMatchObject({ label: "Qnt ", value: "--  ", highlighted: false });
    expect(model.cells[4]).toMatchObject({ label: "VelIn", value: "96  ", highlighted: false });
    expect(model.cells[5]).toMatchObject({ label: "InQ ", value: "1/16", highlighted: false });
    expect(model.cells[6]).toMatchObject({ label: "Rvrs", value: "--  ", highlighted: false });
    expect(model.cells[7]).toMatchObject({ label: "SyncRpt", value: "ON  ", highlighted: true });
  });

  test("melodic NOTE FX Parameter Page model preserves sparse slot and alt algorithm cell", () => {
    const knobs = Array.from({ length: 8 }, (_, k) => ({
      abbrev: "K" + k,
      dspKey: "",
      fmt: (v: number) => "V" + v,
    }));

    const model = melodicNoteFxParameterPageGridModel({
      knobs,
      vals: [87, -4, 55, 0, 0, 9, 0, 3],
      altMode: true,
      noteFXRandomMode: 2,
      knobTouched: 7,
    });

    expect(model.grid).toMatchObject({
      preformatted: true,
      preserveSlots: true,
      startY: 12,
      valueYOffset: 12,
    });
    expect(model.cells).toHaveLength(8);
    expect(model.cells[0]).toMatchObject({ label: "K0  ", value: "V87 ", highlighted: false });
    expect(model.cells[5]).toMatchObject({ label: ">Gate", value: "V9  ", highlighted: false });
    expect(model.cells[6]).toBeNull();
    expect(model.cells[7]).toMatchObject({ label: "Algo", value: "Walk", highlighted: true });
  });

  test("drum repeat groove Parameter Page model exposes slots, cells, gates, and alt nudge text", () => {
    const normal = drumRepeatGrooveParameterPageModel({
      altMode: false,
      gateBits: 0b00000101,
      gateLength: 4,
      velocityScale: [80, 90, 100, 110, 120, 130, 140, 150],
      nudge: [-2, 0, 3, 4, 5, 6, 7, 8],
      knobTouched: 1,
    });

    expect(normal).toMatchObject({
      title: "REPEAT GROOVE",
      valueMode: "velocity",
      valueLabel: "Velocity",
      grid: {
        preformatted: true,
        preserveSlots: true,
        startY: 12,
        valueYOffset: 12,
        rowGap: 24,
      },
    });
    expect(normal.slots).toHaveLength(8);
    expect(normal.cells).toHaveLength(8);
    expect(normal.slots[0]).toEqual({ slot: 0, label: "Vel1", active: true, empty: false, gateState: "on", gateOn: true, value: "80% ", highlighted: false });
    expect(normal.slots[1]).toEqual({ slot: 1, label: "Vel2", active: true, empty: false, gateState: "off", gateOn: false, value: "90% ", highlighted: true });
    expect(normal.slots[2]).toEqual({ slot: 2, label: "Vel3", active: true, empty: false, gateState: "on", gateOn: true, value: "100%", highlighted: false });
    expect(normal.slots[4]).toEqual({ slot: 4, label: "Vel5", active: false, empty: true, gateState: "empty", gateOn: false, value: "", highlighted: false });
    expect(normal.cells[0]).toMatchObject({ label: "Vel1", value: "80% ", highlighted: false });
    expect(normal.cells[1]).toMatchObject({ label: "Vel2", value: "90% ", highlighted: true });
    expect(normal.cells[4]).toBeNull();

    const alt = drumRepeatGrooveParameterPageModel({
      altMode: true,
      gateBits: 0b00000101,
      gateLength: 4,
      velocityScale: [80, 90, 100, 110, 120, 130, 140, 150],
      nudge: [-2, 0, 3, 4, 5, 6, 7, 8],
      knobTouched: 3,
    });

    expect(alt).toMatchObject({ valueMode: "nudge", valueLabel: "Nudge" });
    expect(alt.slots[0]).toMatchObject({ label: "Nud1", active: true, gateState: "on", value: "-2% ", highlighted: false });
    expect(alt.slots[1]).toMatchObject({ label: "Nud2", active: true, gateState: "off", value: " 0% ", highlighted: false });
    expect(alt.slots[2]).toMatchObject({ label: "Nud3", active: true, gateState: "on", value: "+3% ", highlighted: false });
    expect(alt.slots[3]).toMatchObject({ label: "Nud4", active: true, gateState: "off", value: "+4% ", highlighted: true });
    expect(alt.cells[3]).toMatchObject({ label: "Nud4", value: "+4% ", highlighted: true });
  });

  test("track bank overview route preserves specialized renderer selection", () => {
    expect(trackBankOverviewRoute({ isDrum: true, bank: 0, allLanesConfirmed: true })).toBe("drumLane");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 7, allLanesConfirmed: false })).toBe("allLanesConfirm");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 7, allLanesConfirmed: true })).toBe("allLanes");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 1, allLanesConfirmed: true })).toBe("drumNoteFx");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 5, allLanesConfirmed: true })).toBe("drumRepeatGroove");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 6, allLanesConfirmed: true })).toBe("motion");
    expect(trackBankOverviewRoute({ isDrum: false, bank: 6, allLanesConfirmed: true })).toBe("motion");
    expect(trackBankOverviewRoute({ isDrum: false, bank: 1, allLanesConfirmed: true })).toBe("melodicNoteFx");
    expect(trackBankOverviewRoute({ isDrum: true, bank: 3, allLanesConfirmed: true })).toBe("drumMidiDelay");
    expect(trackBankOverviewRoute({ isDrum: false, bank: 3, allLanesConfirmed: true })).toBe("generic");
  });

  test("parameter page feedback policy is owned by the active page route", () => {
    expect(parameterPageFeedbackPolicy({ isDrum: false, bank: 6, allLanesConfirmed: true })).toBe("focused");
    expect(parameterPageFeedbackPolicy({ isDrum: false, bank: 1, allLanesConfirmed: true })).toBe("focused");
    expect(parameterPageFeedbackPolicy({ isDrum: false, bank: 3, allLanesConfirmed: true })).toBe("focused");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 0, allLanesConfirmed: true })).toBe("overview");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 1, allLanesConfirmed: true })).toBe("overview");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 3, allLanesConfirmed: true })).toBe("overview");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 5, allLanesConfirmed: true })).toBe("overview");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 7, allLanesConfirmed: true })).toBe("overview");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 7, allLanesConfirmed: false })).toBe("mode-owned");
    expect(parameterPageFeedbackPolicy({ isDrum: true, bank: 6, allLanesConfirmed: true })).toBe("focused");
  });
});

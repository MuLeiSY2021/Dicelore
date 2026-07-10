// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { StreamMessageSchema, LoreStreamMessageSchema, DiceStreamMessageSchema, CLIENT_PROTOCOL } from "./index.js";

describe("StreamMessageSchema", () => {
  it("按 type 判别 narration_delta", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "narration_delta", turnId: "t1", text: "你推开门",
    });
    expect(m.type).toBe("narration_delta");
  });
  it("拒绝未知 type", () => {
    expect(() =>
      StreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "bogus" }),
    ).toThrow();
  });

  it("roll_staged / roll_committed 可判别", () => {
    const staged = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "roll_staged",
      pendingRoll: { eventId: 12, shape: "outcome", label: "撬锁",
        yourSide: { name: "张三", exprDisplay: "1d100" },
        bands: [{ label: "成功", min: 1, max: 60, plan: "锁应声而开、内室尽收眼底", narration: "你屏息拨动锁芯" }] },
    });
    expect(staged.type).toBe("roll_staged");
    const committed = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "roll_committed",
      eventId: 12, rolls: [18], total: 18, dc: 15, outcome: "success",
    });
    expect(committed.type).toBe("roll_committed");
  });

  it("roll_staged 的 band 缺 plan/narration 被拒（RT-FE5 两字段必填）", () => {
    expect(() =>
      StreamMessageSchema.parse({
        protocol: CLIENT_PROTOCOL, type: "roll_staged",
        pendingRoll: { eventId: 12, shape: "outcome", label: "撬锁",
          yourSide: { name: "张三", exprDisplay: "1d100" },
          bands: [{ label: "成功", min: 1, max: 60 }] },
      }),
    ).toThrow();
  });

  it("hidden_roll 可判别（带完整结果 result/band，dc 可选）", () => {
    // outcome 型暗骰:result=roll、band=命中档、无 dc。
    const outcome = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "hidden_roll",
      eventId: 21, label: "GM 暗中检定 NPC 的谎言", result: 73,
      band: { label: "成功", consequence: "识破" },
    });
    expect(outcome.type).toBe("hidden_roll");
    if (outcome.type === "hidden_roll") {
      expect(outcome.eventId).toBe(21);
      expect(outcome.label).toBe("GM 暗中检定 NPC 的谎言");
      expect(outcome.result).toBe(73);
      expect(outcome.band?.label).toBe("成功");
      expect(outcome.dc).toBeUndefined();
    }
    // contest 型暗骰:result=a.total、dc=b.total。
    const contest = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "hidden_roll",
      eventId: 22, label: "暗中对抗", result: 18, dc: 15,
      band: { label: "success", consequence: "" },
    });
    expect(contest.type).toBe("hidden_roll");
    if (contest.type === "hidden_roll") expect(contest.dc).toBe(15);
  });

  it("turn_ended 无 usage 仍通过（向后兼容）", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "t1", seq: 3,
    });
    expect(m.type).toBe("turn_ended");
    if (m.type === "turn_ended") expect(m.usage).toBeUndefined();
  });

  it("turn_ended 带 usage 解析正确", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "t1", seq: 3,
      usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 10, cacheCreationTokens: 5 },
    });
    expect(m.type).toBe("turn_ended");
    if (m.type === "turn_ended") {
      expect(m.usage).toEqual({
        inputTokens: 100, outputTokens: 40, cacheReadTokens: 10, cacheCreationTokens: 5,
      });
    }
  });

  it("context_compacting start（无 result）可判别", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: "start",
    });
    expect(m.type).toBe("context_compacting");
    if (m.type === "context_compacting") {
      expect(m.phase).toBe("start");
      expect(m.result).toBeUndefined();
    }
  });

  it("context_compacting done success / failed 携带 result + error", () => {
    const ok = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: "done", result: "success",
    });
    if (ok.type === "context_compacting") expect(ok.result).toBe("success");

    const bad = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: "done", result: "failed", error: "boom",
    });
    if (bad.type === "context_compacting") {
      expect(bad.result).toBe("failed");
      expect(bad.error).toBe("boom");
    }
  });

  it("context_compacting 拒绝非法 phase / result", () => {
    expect(() => StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: "mid",
    })).toThrow();
    expect(() => StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "context_compacting", phase: "done", result: "maybe",
    })).toThrow();
  });
});

describe("LoreStreamMessageSchema", () => {
  it("DiceStreamMessageSchema 是 dicegm 域别名（同一 schema）", () => {
    expect(DiceStreamMessageSchema).toBe(StreamMessageSchema);
  });

  it("五类 + error 均可判别", () => {
    const started = LoreStreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "b1-l1" });
    expect(started.type).toBe("turn_started");

    const ended = LoreStreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "b1-l1", seq: 7 });
    expect(ended.type).toBe("turn_ended");
    if (ended.type === "turn_ended") expect(ended.seq).toBe(7);

    const call = LoreStreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "toolcall",
      tool: "write_lore", args: { name: "黄枫谷", content: "正道" }, result: { ok: true }, ok: true,
    });
    expect(call.type).toBe("toolcall");
    if (call.type === "toolcall") expect(call.tool).toBe("write_lore");

    const delta = LoreStreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "draft_delta", seq: 3, changes: [{ section: "world" }],
    });
    expect(delta.type).toBe("draft_delta");
    if (delta.type === "draft_delta") expect(delta.changes).toEqual([{ section: "world" }]);

    const err = LoreStreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "error", code: "build_tool_error", message: "工具失败" });
    expect(err.type).toBe("error");
  });

  it("toolcall 无 result 仍通过（result 可选）", () => {
    const m = LoreStreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "toolcall", tool: "validate", args: {}, ok: false,
    });
    expect(m.type).toBe("toolcall");
    if (m.type === "toolcall") expect(m.result).toBeUndefined();
  });

  it("拒绝 dicegm 专属类型（narration_delta 不在 loregm 枚举）", () => {
    expect(() =>
      LoreStreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "narration_delta", turnId: "t1", text: "x" }),
    ).toThrow();
  });
});

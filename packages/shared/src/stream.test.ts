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
        yourSide: { name: "张三", exprDisplay: "1d100" }, bands: [{ label: "成功", min: 1, max: 60 }] },
    });
    expect(staged.type).toBe("roll_staged");
    const committed = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "roll_committed",
      eventId: 12, rolls: [18], total: 18, dc: 15, outcome: "success",
    });
    expect(committed.type).toBe("roll_committed");
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

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { StreamMessageSchema, CLIENT_PROTOCOL } from "./index.js";

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

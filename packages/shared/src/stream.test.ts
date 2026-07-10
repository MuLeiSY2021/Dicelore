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

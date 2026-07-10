// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 上下文压缩信号解析（裁决 usage-and-context §四）——不烧 LLM，纯函数验 SDK 消息 → 压缩进行态映射。
// SDKStatusMessage(status/compact_result) + SDKCompactBoundaryMessage 三来源；去重逻辑由 DiceGm 回合内标志处理。

import { describe, it, expect } from "vitest";
import { parseCompacting } from "./DiceGm.js";

describe("parseCompacting（SDK 流 → 压缩进行态信号）", () => {
  it("SDKStatusMessage status==='compacting' → start", () => {
    expect(parseCompacting({ type: "system", subtype: "status", status: "compacting", session_id: "s" }))
      .toEqual({ phase: "start" });
  });

  it("SDKStatusMessage compact_result==='success' → done success", () => {
    expect(parseCompacting({ type: "system", subtype: "status", status: null, compact_result: "success" }))
      .toEqual({ phase: "done", result: "success" });
  });

  it("SDKStatusMessage compact_result==='failed' → done failed（携带 compact_error）", () => {
    expect(parseCompacting({ type: "system", subtype: "status", compact_result: "failed", compact_error: "ctx too large" }))
      .toEqual({ phase: "done", result: "failed", error: "ctx too large" });
  });

  it("SDKCompactBoundaryMessage(subtype:'compact_boundary') → done success", () => {
    expect(parseCompacting({ type: "system", subtype: "compact_boundary", compact_metadata: { trigger: "auto", pre_tokens: 1 } }))
      .toEqual({ phase: "done", result: "success" });
  });

  it("status:'requesting' / init / 其它系统消息 → null", () => {
    expect(parseCompacting({ type: "system", subtype: "status", status: "requesting" })).toBeNull();
    expect(parseCompacting({ type: "system", subtype: "init", session_id: "s" })).toBeNull();
  });

  it("非 system 消息（assistant/result/user）→ null", () => {
    expect(parseCompacting({ type: "assistant", message: {} })).toBeNull();
    expect(parseCompacting({ type: "result", usage: {} })).toBeNull();
    expect(parseCompacting(undefined)).toBeNull();
  });
});

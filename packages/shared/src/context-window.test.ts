// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { CONTEXT_WINDOW, contextWindowFor, contextPct } from "./index.js";

describe("CONTEXT_WINDOW（model 上下文窗口表 · 裁决 usage-and-context §六）", () => {
  it("含已知 model 与 default 兜底键", () => {
    expect(CONTEXT_WINDOW["claude-opus-4-8"]).toBe(200_000);
    expect(CONTEXT_WINDOW["claude-sonnet-5"]).toBe(200_000);
    expect(CONTEXT_WINDOW["claude-haiku-4-5-20251001"]).toBe(200_000);
    expect(CONTEXT_WINDOW.default).toBe(200_000);
  });
});

describe("contextWindowFor", () => {
  it("已知 model → 表内值", () => {
    expect(contextWindowFor("claude-opus-4-8")).toBe(CONTEXT_WINDOW["claude-opus-4-8"]);
  });
  it("未知 model → default", () => {
    expect(contextWindowFor("some-unknown-model")).toBe(CONTEXT_WINDOW.default);
  });
  it("空串 / null / undefined → default", () => {
    expect(contextWindowFor("")).toBe(CONTEXT_WINDOW.default);
    expect(contextWindowFor(null)).toBe(CONTEXT_WINDOW.default);
    expect(contextWindowFor(undefined)).toBe(CONTEXT_WINDOW.default);
  });
});

describe("contextPct", () => {
  it("tokens / window", () => {
    expect(contextPct(100_000, 200_000)).toBe(0.5);
    expect(contextPct(0, 200_000)).toBe(0);
  });
  it("窗口 <=0 → 0（防除零）", () => {
    expect(contextPct(100, 0)).toBe(0);
    expect(contextPct(100, -1)).toBe(0);
  });
  it("超窗口（压缩前瞬时 >1）不设上限", () => {
    expect(contextPct(220_000, 200_000)).toBeCloseTo(1.1);
  });
});

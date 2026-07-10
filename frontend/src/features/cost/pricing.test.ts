// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { priceFor, estimateCostUsd, formatUsd, formatTokens, PRICING } from "./pricing.js";

describe("priceFor", () => {
  it("命中已知 model 返回其单价", () => {
    expect(priceFor("claude-opus-4-8")).toEqual(PRICING["claude-opus-4-8"]);
  });
  it("未知 / 空 model 落 default", () => {
    expect(priceFor("nope")).toEqual(PRICING.default);
    expect(priceFor(null)).toEqual(PRICING.default);
    expect(priceFor(undefined)).toEqual(PRICING.default);
    expect(priceFor("")).toEqual(PRICING.default);
  });
});

describe("estimateCostUsd", () => {
  it("四类 token × 各自单价 / 1e6 求和", () => {
    // opus: input 15, output 75, cacheRead 1.5, cacheWrite 18.75（$/1M）
    const usd = estimateCostUsd("claude-opus-4-8", {
      inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
    });
    expect(usd).toBeCloseTo(15, 6);
  });
  it("混合四类累加", () => {
    const usd = estimateCostUsd("claude-sonnet-5", {
      inputTokens: 2_000_000, outputTokens: 1_000_000, cacheReadTokens: 10_000_000, cacheCreationTokens: 0,
    });
    // 2*3 + 1*15 + 10*0.3 = 6 + 15 + 3 = 24
    expect(usd).toBeCloseTo(24, 6);
  });
  it("缺失字段按 0 计、负值截 0", () => {
    expect(estimateCostUsd("claude-opus-4-8", {})).toBe(0);
    expect(estimateCostUsd("claude-opus-4-8", { inputTokens: -5 })).toBe(0);
  });
});

describe("formatUsd", () => {
  it("常规两三位有效数、去尾零", () => {
    expect(formatUsd(0.038)).toBe("$0.038");
    expect(formatUsd(0.05)).toBe("$0.05");
    expect(formatUsd(1.2)).toBe("$1.2");
  });
  it("极小值显 <$0.001；零 / 负显 $0", () => {
    expect(formatUsd(0.0004)).toBe("<$0.001");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(-1)).toBe("$0");
  });
});

describe("formatTokens", () => {
  it("千分位以空格分隔", () => {
    expect(formatTokens(5100)).toBe("5 100");
    expect(formatTokens(720)).toBe("720");
    expect(formatTokens(1234567)).toBe("1 234 567");
  });
});

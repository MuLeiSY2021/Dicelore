// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { estimateCostUsd, fmtTokens, PRICING } from "./pricing.js";

it("四类 token × 单价求和 / 1e6", () => {
  const p = PRICING.default;
  const u = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  expect(estimateCostUsd(u)).toBeCloseTo(p.in, 6);
  const mix = { inputTokens: 3200, outputTokens: 480, cacheReadTokens: 9800, cacheCreationTokens: 410 };
  const expected = (3200 * p.in + 480 * p.out + 9800 * p.cacheRead + 410 * p.cacheWrite) / 1e6;
  expect(estimateCostUsd(mix)).toBeCloseTo(expected, 9);
});

it("未知 model 走 default 单价", () => {
  const u = { inputTokens: 1000, outputTokens: 1000, cacheReadTokens: 0, cacheCreationTokens: 0 };
  expect(estimateCostUsd(u, "nonexistent-model")).toBe(estimateCostUsd(u, "default"));
});

it("fmtTokens：≥1000 缩成 k、否则原样", () => {
  expect(fmtTokens(3200)).toBe("3.2k");
  expect(fmtTokens(480)).toBe("480");
  expect(fmtTokens(1000)).toBe("1.0k");
});

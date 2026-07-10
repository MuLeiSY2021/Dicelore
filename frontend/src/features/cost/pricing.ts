// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// co-play 裁决 §2：单价表 + 估价。前后端共享的「数据不是逻辑」——占位单价可按真实计价改。
// 每百万 token 单价(USD)。default 兜底未知 model。

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface ModelPrice { in: number; out: number; cacheRead: number; cacheWrite: number }

export const PRICING: Record<string, ModelPrice> = {
  default: { in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

// 四类 token × 单价求和 / 1e6。未知 model 走 default。纯查表求和、无副作用。
export function estimateCostUsd(u: TurnUsage, model = "default"): number {
  const p = PRICING[model] ?? PRICING.default;
  return (
    u.inputTokens * p.in +
    u.outputTokens * p.out +
    u.cacheReadTokens * p.cacheRead +
    u.cacheCreationTokens * p.cacheWrite
  ) / 1e6;
}

// token 数千分位友好显示（≥1000 → "1.2k"，否则原样）。
export function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

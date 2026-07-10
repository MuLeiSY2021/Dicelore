// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// per-turn usage 估价（RT-FE16 co-play / co-build 共用）。与 context-window 的窗口表同性质：
// 是**数据不是逻辑**，占位值按 Anthropic 公开规格填、可改。单位 = 美元 / 每 1M token。
// 四类 token 各自计价：input（未命中缓存的输入）/ output（输出）/ cacheRead（命中缓存读）/ cacheWrite（写缓存）。
// 未知 model 落 default，保证估价永有单价。

export interface ModelPrice {
  /** 美元 / 1M input token（未命中缓存） */
  input: number;
  /** 美元 / 1M output token */
  output: number;
  /** 美元 / 1M cache-read token（命中缓存读，通常约 input 的 0.1x） */
  cacheRead: number;
  /** 美元 / 1M cache-write token（写缓存，通常约 input 的 1.25x） */
  cacheWrite: number;
}

// 占位规格（Anthropic 公开定价，$/1M token）。真实规格变更时改此表即可。
export const PRICING: Record<string, ModelPrice> = {
  "claude-opus-4-8": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  default: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

// 四类 token 计数（对齐 stream.ts turn_ended.usage / loregm messages 响应 usage）。
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

// 查某 model 的单价；未知（含空串）→ default。纯查表，无副作用。
export function priceFor(model: string | null | undefined): ModelPrice {
  if (model && Object.prototype.hasOwnProperty.call(PRICING, model)) return PRICING[model];
  return PRICING.default;
}

// 估价：四类 token × 各自单价 / 1e6，求和。缺失字段按 0 计。永不为负。
export function estimateCostUsd(model: string | null | undefined, usage: Partial<TokenUsage>): number {
  const p = priceFor(model);
  const inp = Math.max(0, usage.inputTokens ?? 0);
  const out = Math.max(0, usage.outputTokens ?? 0);
  const cr = Math.max(0, usage.cacheReadTokens ?? 0);
  const cw = Math.max(0, usage.cacheCreationTokens ?? 0);
  return (inp * p.input + out * p.output + cr * p.cacheRead + cw * p.cacheWrite) / 1_000_000;
}

// 估价格式化：≈$0.038。< $0.001 时显 <$0.001（避免显 $0.000 误导）。
export function formatUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.001) return "<$0.001";
  return "$" + usd.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

// token 数千分位格式化：5100 → "5 100"（对齐原型 turn-usage 呈现）。
export function formatTokens(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("en-US").replace(/,/g, " ");
}

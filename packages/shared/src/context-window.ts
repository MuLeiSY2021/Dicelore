// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// ═══════════════════════════════════════════════════════════════════════════
// 每个 model 的上下文窗口大小（token）——前后端共用的「数据表」（裁决 usage-and-context §六）。
//
// 与 co-play 的 pricing 表同性质：是**数据不是逻辑**，占位值可按真实规格改。两处用途同口径：
//   ① GET /usage 的 contextWindow / contextPct（RT-FE14 foot 上下文占用%）；
//   ② buildQueryOptions 注入 SDK settings.autoCompactWindow（RT-FE15 自动压缩，C1 定调）。
// 未知 model 落 default，保证 contextPct 永有分母、auto-compact 永有窗口。
// ═══════════════════════════════════════════════════════════════════════════

export const CONTEXT_WINDOW: Record<string, number> = {
  "claude-sonnet-5": 200_000,
  "claude-opus-4-8": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  default: 200_000,
};

// 查某 model 的窗口大小；未知（含空串）→ default。纯查表，无副作用。
export function contextWindowFor(model: string | null | undefined): number {
  if (model && Object.prototype.hasOwnProperty.call(CONTEXT_WINDOW, model)) {
    return CONTEXT_WINDOW[model];
  }
  return CONTEXT_WINDOW.default;
}

// 上下文占用比 = contextTokens / contextWindow。窗口非正 → 0（防除零）；结果不设上限
// （压缩前可能瞬时 >1，foot 显示端自行 clamp）。
export function contextPct(contextTokens: number, contextWindow: number): number {
  if (!(contextWindow > 0)) return 0;
  return contextTokens / contextWindow;
}

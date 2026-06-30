// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { buildPresentationModel, type PresentationModel } from "./model.js";

// 玩家视图（mock 组件7 渲染契约）：玩家「应该看到」的全部 = 叙事流 + 面板。
// 叙事流 = 可见的 narrate + reveal event（流①，玩家读的剧情/披露）；
// 面板 = buildPresentationModel（流②，机械回显 + 状态菜单 + 待选项/待掷）。
// 不含：GM 的 raw 聊天正文（不该给玩家，复述=泄漏/浪费）、隐藏/暗值。
// 这是 eval 的评分基准，也是组件7 将来该实现的渲染契约（总体架构 §6 三流 / 玩家客户端-接口）。
//
// ⚠ 当前运行时无直接消费者：eval 跑分底座已改为 CC 经 play-mcp 连真后端 WS+presentation 兑现该契约
// （wiki Skills-eval.md §0/§关键耦合澄清）。本函数仍是 wiki 单源指向的「玩家应见全部」mock 契约权威
// （Skills-eval.md / Skills包.md 多处引），保留为契约参照与未来组件7 渲染契约底座，勿误删。

export interface NarrationEntry {
  seq: number;
  kind: "narrate" | "reveal";
  text: string;
}

export interface PlayerView {
  narration: NarrationEntry[];
  panel: PresentationModel;
}

export function buildPlayerView(db: DB, opts: { sinceSeq?: number } = {}): PlayerView {
  const sinceSeq = opts.sinceSeq ?? 0;
  const rows = db
    .prepare(
      `SELECT seq, kind, content FROM log
        WHERE seq > ? AND kind IN ('narrate','reveal') AND visible = 1
        ORDER BY seq`,
    )
    .all(sinceSeq) as { seq: number; kind: "narrate" | "reveal"; content: string | null }[];
  return {
    narration: rows.map((r) => ({ seq: r.seq, kind: r.kind, text: r.content ?? "" })),
    panel: buildPresentationModel(db, { turnStartSeq: opts.sinceSeq }),
  };
}

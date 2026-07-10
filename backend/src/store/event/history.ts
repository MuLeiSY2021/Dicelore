// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../db.js";

export interface History {
  id: number;
  seq_from: number;
  seq_to: number;
  summary: string;
  created_seq: number;
}

export function historyAppend(
  db: DB,
  h: { seq_from: number; seq_to: number; summary: string; created_seq: number },
): number {
  const info = db
    .prepare(
      `INSERT INTO history(seq_from, seq_to, summary, created_seq) VALUES(?,?,?,?)`,
    )
    .run(h.seq_from, h.seq_to, h.summary, h.created_seq);
  return Number(info.lastInsertRowid);
}

export function historyList(db: DB): History[] {
  return db
    .prepare(`SELECT id, seq_from, seq_to, summary, created_seq FROM history ORDER BY id`)
    .all() as History[];
}

// 记忆工具写原语（A′ §6）：把 [seq_from, seq_to] 一段 log 压缩成一条 history 摘要。
// summary 由 GM(agent) 读那段 log 自行拟就、经工具入参带入（优先保留 moment 语义由 GM 落笔时体现）；
// created_seq = 压缩发生时的时间锚点 = 当前最大 log seq（空库回落 seq_to）。
// 触发时机=GM 手动调（agent 自判何时压缩，裁决 C6）。与 markMoment 并列，是 toolgen writeMatch
// 认得的正典写原语——声明式工具永不裸跑 SQL，只路由到此。返回新 history 行的自增 id。
export function historyCompact(
  db: DB,
  h: { seq_from: number; seq_to: number; summary: string },
): number {
  const row = db.prepare(`SELECT COALESCE(MAX(seq), 0) AS m FROM log`).get() as { m: number };
  const createdSeq = row.m > 0 ? row.m : h.seq_to;
  return historyAppend(db, { ...h, created_seq: createdSeq });
}

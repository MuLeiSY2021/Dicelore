// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/ruleRecall.ts
import type { DB } from "../store/db.js";
import { ruleSearch } from "../store/rule.js";
import { metaSet } from "../session/resolve.js";

// 被动 rule 召回:AI 只读、本地 FTS,远小于 UserPromptSubmit 30s 超时。
export function recallRules(db: DB, prompt: string, limit = 5): string {
  const hits = ruleSearch(db, prompt, limit);
  if (hits.length === 0) return "";
  return ["相关团本规则(被动召回,务必遵守):", ...hits.map((r) => `- ${r.name}: ${r.content}`)].join("\n");
}

// 记本轮起始 seq,供 Stop hook 圈本轮 event 区间。
export function recordTurnStart(db: DB): number {
  const row = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  const seq = row.s ?? 0;
  metaSet(db, "turn_start_seq", String(seq));
  return seq;
}

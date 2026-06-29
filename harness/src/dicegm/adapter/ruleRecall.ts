// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/ruleRecall.ts
import type { DB, SessionBackend } from "@dicelore/interface";

// 被动 rule 召回:AI 只读、本地 FTS,远小于 UserPromptSubmit 30s 超时。
export function recallRules(backend: SessionBackend, prompt: string, limit = 5): string {
  const hits = backend.ruleSearch(prompt, limit);
  if (hits.length === 0) return "";
  return ["相关团本规则(被动召回,务必遵守):", ...hits.map((r) => `- ${r.name}: ${r.content}`)].join("\n");
}

// 记本轮起始 seq,供 Stop hook 圈本轮 event 区间。head seq 直读裸 db(原始读,非端口面);
// turn_start_seq 经 Meta 端口写。
export function recordTurnStart(backend: SessionBackend, db: DB): number {
  const row = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  const seq = row.s ?? 0;
  backend.metaSet("turn_start_seq", String(seq));
  return seq;
}

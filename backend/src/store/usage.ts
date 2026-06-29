// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

// UsageInput 下沉 @dicelore/interface(SessionBackend.recordUsage 端口方法面引用)；re-export 保持公共面。
import type { UsageInput } from "@dicelore/interface";
export type { UsageInput };

// ═══════════════════════════════════════════════════════════════════════════
// CO-采集：token 用量结构化（Agent SDK result 回传的 usage 采出落库）
//
// 归因维度 = per-turn + per-agent 双采（已自决）：
//   每条 usage 行同时挂 turnId（哪一回合烧的）+ agent（哪个 agent 烧的）+ sessionId
//   （哪一局）。这样既能按回合算「这步贵不贵」，也能按 agent 算「GM vs build 谁烧得多」，
//   还能按 session 出整局总账——三个维度都从同一张明细表聚合，不预聚合（避免维度耦合，
//   新增维度只加列不改聚合逻辑）。可视化（CO-前端）另起线，本模块只采集落库 + 查询。
//
// 为何独立一张表而非塞 log：usage 是「带外计量」（不进玩家叙事、不入快照回滚、不进 FTS），
// 与 log/snapshot 生命周期完全解耦——独立 CREATE，和 SNAP-1 的 snapshot 表互不干涉。
// ═══════════════════════════════════════════════════════════════════════════

// 写入一条 usage（DiceSession 回合末经端口落库）。可选 cache token 缺省归零（SDK 偶尔不回）。
export interface UsageRow {
  id: number;
  sessionId: string;
  turnId: string;
  agent: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  createdAt: string;
}

// 聚合结果：四类 token 求和（不含明细维度，纯计量）。
export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function recordUsage(db: DB, u: UsageInput): number {
  const info = db
    .prepare(
      `INSERT INTO usage_log
        (session_id, turn_id, agent, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      u.sessionId, u.turnId, u.agent, u.model ?? null,
      u.inputTokens, u.outputTokens, u.cacheReadTokens ?? 0, u.cacheCreationTokens ?? 0,
    );
  return Number(info.lastInsertRowid);
}

function rowToUsage(r: {
  id: number; session_id: string; turn_id: string; agent: string; model: string | null;
  input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; created_at: string;
}): UsageRow {
  return {
    id: r.id, sessionId: r.session_id, turnId: r.turn_id, agent: r.agent, model: r.model,
    inputTokens: r.input_tokens, outputTokens: r.output_tokens,
    cacheReadTokens: r.cache_read_tokens, cacheCreationTokens: r.cache_creation_tokens, createdAt: r.created_at,
  };
}

export function listUsage(db: DB): UsageRow[] {
  const rows = db
    .prepare(
      `SELECT id, session_id, turn_id, agent, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, created_at
       FROM usage_log ORDER BY id`,
    )
    .all() as Parameters<typeof rowToUsage>[0][];
  return rows.map(rowToUsage);
}

// 聚合查询：按 turn / agent / session 求和四类 token。空集返回全零。
const SUM_COLS =
  "COALESCE(SUM(input_tokens),0) i, COALESCE(SUM(output_tokens),0) o, " +
  "COALESCE(SUM(cache_read_tokens),0) cr, COALESCE(SUM(cache_creation_tokens),0) cc";

function totals(db: DB, where: string, key: string): UsageTotals {
  const r = db.prepare(`SELECT ${SUM_COLS} FROM usage_log WHERE ${where}`).get(key) as
    { i: number; o: number; cr: number; cc: number };
  return { inputTokens: r.i, outputTokens: r.o, cacheReadTokens: r.cr, cacheCreationTokens: r.cc };
}

export function usageByTurn(db: DB, turnId: string): UsageTotals { return totals(db, "turn_id=?", turnId); }
export function usageByAgent(db: DB, agent: string): UsageTotals { return totals(db, "agent=?", agent); }
export function usageBySession(db: DB, sessionId: string): UsageTotals { return totals(db, "session_id=?", sessionId); }

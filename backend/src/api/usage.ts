// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { listUsage, usageBySession, usageContext, type DB, type UsageRow, type UsageTotals, type PerTurnUsage } from "@dicelore/backend";
import { contextWindowFor, contextPct } from "@dicelore/shared";

// ═══════════════════════════════════════════════════════════════════════════
// CO-查询面(缝 B 只读投影):GET /sessions/dicegm/:id/usage
//
// 把 store/usage.ts 的现成查询投影成一个 JSON 报告。分两层字段:
//   ── 原有归因维度(不预聚合，over listUsage 分组) ──
//   - session : 整局四类 token 合计(usageBySession 直接聚合)
//   - byTurn  : turnId → 该回合合计
//   - byAgent : agent  → 该 agent 合计
//   - rows    : 本局明细行(仅 ?rows=1 时附上)
//   ── 上下文占用派生(裁决 usage-and-context §一/§二 · RT-FE14/17) ──
//   - model         : 当前局模型(最近一轮 model)
//   - contextTokens : 当前上下文 token(最近一轮 input+cacheRead+cacheCreation)
//   - contextWindow : model 窗口大小(查 CONTEXT_WINDOW 表)
//   - contextPct    : contextTokens / contextWindow(foot 上下文占用%)
//   - sessionTotal  : 整局累计 token(Σ 四类)——bay-local session usage
//   - perTurn       : 各回合四类 token(对接 co-play per-turn 内联)
//   - memoryBreakdown? / mcpBreakdown? : RT-FE19 分项(optional;v1 无聚合源→不下发，向后兼容)
//
// 纯只读:不写库、不改 server.ts(挂载归组合根)。per-session 物理隔离——本局 db
// 即本局全部 usage_log,故分组直接 over listUsage(本库)即可,无需再按 sessionId 过滤。
// ═══════════════════════════════════════════════════════════════════════════

// RT-FE19 分项(optional·向后兼容)。memoryBreakdown=prompt 各段 token；mcpBreakdown=MCP 工具消耗。
// v1 无聚合源(prompt 分段 token 未落库 / SDK usage 不按工具拆)→ 不下发；字段留作契约位、前端可容缺。
export interface MemorySegment { segment: string; tokens: number; }
export interface McpToolUsage { tool: string; calls: number; tokens: number; }

export interface UsageReport {
  session: UsageTotals;
  byTurn: Record<string, UsageTotals>;
  byAgent: Record<string, UsageTotals>;
  rows?: UsageRow[];
  // ── 上下文占用派生(裁决 usage-and-context) ──
  model: string;
  contextTokens: number;
  contextWindow: number;
  contextPct: number;
  sessionTotal: number;
  perTurn: PerTurnUsage[];
  // ── RT-FE19 分项(optional) ──
  memoryBreakdown?: MemorySegment[];
  mcpBreakdown?: McpToolUsage[];
}

export interface UsageDeps {
  // 组合根注入:据 sessionId 开本局只读 db 句柄(同 dice/lore 的 openSession 端口)。
  openSession: (id: string) => DB;
}

function zero(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
}

// 把一行的四类 token 累加进累加器(就地)。
function add(acc: UsageTotals, r: UsageRow): void {
  acc.inputTokens += r.inputTokens;
  acc.outputTokens += r.outputTokens;
  acc.cacheReadTokens += r.cacheReadTokens;
  acc.cacheCreationTokens += r.cacheCreationTokens;
}

// 明细行按某维度分组求和(turnId / agent)。不预聚合,分组逻辑与维度解耦(新增维度只换 keyOf)。
function groupBy(rows: UsageRow[], keyOf: (r: UsageRow) => string): Record<string, UsageTotals> {
  const out: Record<string, UsageTotals> = {};
  for (const r of rows) {
    const k = keyOf(r);
    (out[k] ??= zero());
    add(out[k], r);
  }
  return out;
}

export function createUsageApp(deps: UsageDeps): Hono {
  const app = new Hono();

  app.get("/sessions/dicegm/:id/usage", (c) => {
    const id = c.req.param("id");
    const db = deps.openSession(id);
    const rows = listUsage(db);
    const ctx = usageContext(db); // {model, contextTokens, sessionTotal, perTurn}
    const contextWindow = contextWindowFor(ctx.model); // 查 CONTEXT_WINDOW 表(未知→default)
    const report: UsageReport = {
      session: usageBySession(db, id),
      byTurn: groupBy(rows, (r) => r.turnId),
      byAgent: groupBy(rows, (r) => r.agent),
      model: ctx.model,
      contextTokens: ctx.contextTokens,
      contextWindow,
      contextPct: contextPct(ctx.contextTokens, contextWindow),
      sessionTotal: ctx.sessionTotal,
      perTurn: ctx.perTurn,
      // memoryBreakdown / mcpBreakdown：v1 无聚合源，省略（optional·向后兼容）。
    };
    if (c.req.query("rows") === "1") report.rows = rows;
    return c.json(report);
  });

  return app;
}

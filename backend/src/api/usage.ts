// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { listUsage, usageBySession, type DB, type UsageRow, type UsageTotals } from "@dicelore/backend";

// ═══════════════════════════════════════════════════════════════════════════
// CO-查询面(缝 B 只读投影):GET /sessions/:id/usage
//
// 把 store/usage.ts 的现成查询(usageBySession + listUsage 分组)投影成一个 JSON 报告:
//   { byTurn, byAgent, session, rows? }
//   - session : 整局四类 token 合计(usageBySession 直接聚合)
//   - byTurn  : turnId → 该回合合计(本局明细按 turnId 分组求和)
//   - byAgent : agent  → 该 agent 合计(本局明细按 agent 分组求和)
//   - rows    : 本局明细行(仅 ?rows=1 时附上,默认省以保持 payload 轻)
//
// 纯只读:不写库、不改 server.ts(挂载归组合根)。per-session 物理隔离——本局 db
// 即本局全部 usage_log,故分组直接 over listUsage(本库)即可,无需再按 sessionId 过滤。
// ═══════════════════════════════════════════════════════════════════════════

export interface UsageReport {
  session: UsageTotals;
  byTurn: Record<string, UsageTotals>;
  byAgent: Record<string, UsageTotals>;
  rows?: UsageRow[];
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
    const report: UsageReport = {
      session: usageBySession(db, id),
      byTurn: groupBy(rows, (r) => r.turnId),
      byAgent: groupBy(rows, (r) => r.agent),
    };
    if (c.req.query("rows") === "1") report.rows = rows;
    return c.json(report);
  });

  return app;
}

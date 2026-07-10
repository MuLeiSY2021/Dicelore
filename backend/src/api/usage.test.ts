// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, recordUsage, type DB } from "@dicelore/backend";
import { CONTEXT_WINDOW } from "@dicelore/shared";
import { createUsageApp, type UsageReport } from "./usage.js";

// 组合根兜底:per-id 持久内存库(同 lore.test 的 openSession 形态)。
function makeRegistry() {
  const dbs = new Map<string, DB>();
  const openSession = (id: string): DB => {
    let d = dbs.get(id);
    if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); }
    return d;
  };
  return { dbs, openSession };
}

const ZERO = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

describe("GET /sessions/:id/usage — token 用量查询端点(只读投影)", () => {
  it("空数据 → session 全零、byTurn/byAgent 空对象、无 rows", async () => {
    const { openSession } = makeRegistry();
    const app = createUsageApp({ openSession });

    const res = await app.request("/sessions/dicegm/s-empty/usage");
    expect(res.status).toBe(200);
    const body = (await res.json()) as UsageReport;
    expect(body.session).toEqual(ZERO);
    expect(body.byTurn).toEqual({});
    expect(body.byAgent).toEqual({});
    expect(body.rows).toBeUndefined();
    // 上下文派生：空局 model=''、tokens=0、pct=0、窗口落 default、perTurn=[]
    expect(body.model).toBe("");
    expect(body.contextTokens).toBe(0);
    expect(body.contextWindow).toBe(CONTEXT_WINDOW.default);
    expect(body.contextPct).toBe(0);
    expect(body.sessionTotal).toBe(0);
    expect(body.perTurn).toEqual([]);
    // RT-FE19 分项 v1 不下发（optional）
    expect(body.memoryBreakdown).toBeUndefined();
    expect(body.mcpBreakdown).toBeUndefined();
  });

  it("有数据 → 上下文字段：model/contextTokens/contextWindow/contextPct/sessionTotal/perTurn", async () => {
    const { openSession } = makeRegistry();
    const app = createUsageApp({ openSession });
    const db = openSession("sc");
    recordUsage(db, { sessionId: "sc", turnId: "t1", agent: "gm", model: "claude-opus-4-8", inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5 });
    recordUsage(db, { sessionId: "sc", turnId: "t2", agent: "gm", model: "claude-opus-4-8", inputTokens: 200, outputTokens: 60, cacheReadTokens: 20, cacheCreationTokens: 3 });

    const res = await app.request("/sessions/dicegm/sc/usage");
    const body = (await res.json()) as UsageReport;
    expect(body.model).toBe("claude-opus-4-8");
    // contextTokens = 最近一轮 t2：200+20+3 = 223
    expect(body.contextTokens).toBe(223);
    expect(body.contextWindow).toBe(CONTEXT_WINDOW["claude-opus-4-8"]);
    expect(body.contextPct).toBeCloseTo(223 / CONTEXT_WINDOW["claude-opus-4-8"]);
    // sessionTotal = (100+50+10+5)+(200+60+20+3) = 165+283 = 448
    expect(body.sessionTotal).toBe(448);
    expect(body.perTurn.map((p) => p.turnId)).toEqual(["t1", "t2"]);
    expect(body.perTurn[1]).toEqual({ turnId: "t2", inputTokens: 200, outputTokens: 60, cacheReadTokens: 20, cacheCreationTokens: 3 });
  });

  it("有数据 → session 合计 = 全行求和、byTurn/byAgent 按维度分组求和", async () => {
    const { dbs, openSession } = makeRegistry();
    const app = createUsageApp({ openSession });

    // 先开本局库灌三行:两回合、两个 agent。
    const db = openSession("s1");
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheCreationTokens: 1 });
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "build", model: "m", inputTokens: 20, outputTokens: 7, cacheReadTokens: 0, cacheCreationTokens: 3 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", model: "m", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 });

    const res = await app.request("/sessions/dicegm/s1/usage");
    expect(res.status).toBe(200);
    const body = (await res.json()) as UsageReport;

    // session 整局合计
    expect(body.session).toEqual({ inputTokens: 31, outputTokens: 13, cacheReadTokens: 2, cacheCreationTokens: 4 });

    // byTurn:t1 = 行1+行2,t2 = 行3
    expect(body.byTurn.t1).toEqual({ inputTokens: 30, outputTokens: 12, cacheReadTokens: 2, cacheCreationTokens: 4 });
    expect(body.byTurn.t2).toEqual({ inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 });

    // byAgent:gm = 行1+行3,build = 行2
    expect(body.byAgent.gm).toEqual({ inputTokens: 11, outputTokens: 6, cacheReadTokens: 2, cacheCreationTokens: 1 });
    expect(body.byAgent.build).toEqual({ inputTokens: 20, outputTokens: 7, cacheReadTokens: 0, cacheCreationTokens: 3 });

    // 默认不带 rows
    expect(body.rows).toBeUndefined();
  });

  it("?rows=1 → 附本局明细行(按 id 升序),其它 session 的行不串台", async () => {
    const { openSession } = makeRegistry();
    const app = createUsageApp({ openSession });

    const db1 = openSession("s1");
    recordUsage(db1, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 });
    // 另一局(本测试用同一 per-id 库 → 物理隔离),验证端点只读本局
    const db2 = openSession("s2");
    recordUsage(db2, { sessionId: "s2", turnId: "tX", agent: "build", model: "m", inputTokens: 999, outputTokens: 999, cacheReadTokens: 0, cacheCreationTokens: 0 });

    const res = await app.request("/sessions/dicegm/s1/usage?rows=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as UsageReport;
    expect(body.rows).toHaveLength(1);
    expect(body.rows?.[0].turnId).toBe("t1");
    expect(body.rows?.[0].sessionId).toBe("s1");
    // s2 的大数不应出现在 s1 的合计里
    expect(body.session.inputTokens).toBe(10);
  });
});

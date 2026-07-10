// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "./db.js";
import { recordUsage, usageByTurn, usageByAgent, usageBySession, listUsage, usageContext } from "./usage.js";

const memDb = (): DB => { const d = openDb(":memory:"); initSchema(d); return d; };

describe("usage 表(CO-采集：token 用量结构化，per-turn + per-agent 双采)", () => {
  let db: DB;
  beforeEach(() => { db = memDb(); });

  it("recordUsage 落一行,listUsage 读回(含归因维度 turn/session/agent)", () => {
    recordUsage(db, {
      sessionId: "s1", turnId: "t1", agent: "gm", model: "glm-5.2",
      inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5,
    });
    const rows = listUsage(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: "s1", turnId: "t1", agent: "gm", model: "glm-5.2",
      inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5,
    });
    expect(rows[0].id).toBeGreaterThan(0);
    expect(rows[0].createdAt).toBeTruthy();
  });

  it("可选字段缺省归零(SDK 偶尔不回 cache token)", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", inputTokens: 7, outputTokens: 3 });
    const r = listUsage(db)[0];
    expect(r.cacheReadTokens).toBe(0);
    expect(r.cacheCreationTokens).toBe(0);
    expect(r.model).toBeNull();
  });

  it("usageByTurn 按 turn 聚合(同一 turn 多次采集相加)", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", inputTokens: 100, outputTokens: 50 });
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", inputTokens: 20, outputTokens: 10 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", inputTokens: 5, outputTokens: 5 });
    const t1 = usageByTurn(db, "t1");
    expect(t1.inputTokens).toBe(120);
    expect(t1.outputTokens).toBe(60);
    const t2 = usageByTurn(db, "t2");
    expect(t2.inputTokens).toBe(5);
  });

  it("usageByAgent 按 agent 聚合(跨 turn 累计该 agent 全部用量)", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", inputTokens: 100, outputTokens: 50 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", inputTokens: 30, outputTokens: 20 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "build", inputTokens: 8, outputTokens: 4 });
    const gm = usageByAgent(db, "gm");
    expect(gm.inputTokens).toBe(130);
    expect(gm.outputTokens).toBe(70);
    const build = usageByAgent(db, "build");
    expect(build.inputTokens).toBe(8);
  });

  it("usageBySession 按 session 聚合(全 agent 全 turn 总账)", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", inputTokens: 100, outputTokens: 50, cacheReadTokens: 10 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", inputTokens: 30, outputTokens: 20 });
    const s = usageBySession(db, "s1");
    expect(s.inputTokens).toBe(130);
    expect(s.outputTokens).toBe(70);
    expect(s.cacheReadTokens).toBe(10);
  });

  it("空聚合返回全零(无此 turn/agent/session)", () => {
    expect(usageByTurn(db, "nope")).toMatchObject({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 });
    expect(usageByAgent(db, "nope").inputTokens).toBe(0);
    expect(usageBySession(db, "nope").outputTokens).toBe(0);
  });
});

describe("usageContext（上下文占用派生 · 裁决 usage-and-context §一）", () => {
  let db: DB;
  beforeEach(() => { db = memDb(); });

  it("空库 → model=''、contextTokens/sessionTotal=0、perTurn=[]", () => {
    expect(usageContext(db)).toEqual({ model: "", contextTokens: 0, sessionTotal: 0, perTurn: [] });
  });

  it("contextTokens = 最近一轮 (input+cacheRead+cacheCreation)（不含 output）", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", model: "m", inputTokens: 200, outputTokens: 60, cacheReadTokens: 20, cacheCreationTokens: 3 });
    const ctx = usageContext(db);
    // 最近一轮 = t2：200 + 20 + 3 = 223（output 不计入上下文）
    expect(ctx.contextTokens).toBe(223);
  });

  it("同一 turn 多行（多 agent）→ contextTokens 取该 turn 全行之和", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 100, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", model: "m", inputTokens: 30, outputTokens: 0, cacheReadTokens: 5, cacheCreationTokens: 0 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "sub", model: "m", inputTokens: 40, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 2 });
    // 最近一轮 t2 两行：(30+5) + (40+2) = 77
    expect(usageContext(db).contextTokens).toBe(77);
  });

  it("sessionTotal = Σ 全部行四类 token 之和", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheCreationTokens: 5 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", model: "m", inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheCreationTokens: 1 });
    // (100+50+10+5) + (1+1+1+1) = 165 + 4 = 169
    expect(usageContext(db).sessionTotal).toBe(169);
  });

  it("perTurn 按 turn 出现顺序分组求和，携带 turnId", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0 });
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "m", inputTokens: 20, outputTokens: 7, cacheReadTokens: 0, cacheCreationTokens: 0 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", model: "m", inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 });
    const pt = usageContext(db).perTurn;
    expect(pt.map((p) => p.turnId)).toEqual(["t1", "t2"]);
    expect(pt[0]).toEqual({ turnId: "t1", inputTokens: 30, outputTokens: 12, cacheReadTokens: 0, cacheCreationTokens: 0 });
    expect(pt[1]).toEqual({ turnId: "t2", inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 });
  });

  it("model 取最近一轮非空 model（null 行不覆盖既有）", () => {
    recordUsage(db, { sessionId: "s1", turnId: "t1", agent: "gm", model: "claude-opus-4-8", inputTokens: 1, outputTokens: 1 });
    recordUsage(db, { sessionId: "s1", turnId: "t2", agent: "gm", inputTokens: 1, outputTokens: 1 }); // model 缺省 null
    expect(usageContext(db).model).toBe("claude-opus-4-8");
  });
});

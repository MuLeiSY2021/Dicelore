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
import { recordUsage, usageByTurn, usageByAgent, usageBySession, listUsage } from "./usage.js";

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

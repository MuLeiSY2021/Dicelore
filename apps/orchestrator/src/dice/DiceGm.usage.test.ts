// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// CO-采集：DiceGm token 用量采集点单测。
// 不烧 LLM —— 拆两层验：① parseUsage 纯函数把 SDK result.usage 字段名映射成计量字段；
// ② recordTurnUsage 把采到的用量落进 session db 的 usage_log（per-turn + per-agent，agent='gm'）。
// recordTurnUsage 经 sessionDbPath(sessionId) 自开短连接落库——把 XDG_DATA_HOME 指向 tmp 目录
// 即可让它与本测试读的库同路径，无需触碰 DiceSession/server 注入。

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { openDb, initSchema, listUsage, usageByTurn, sessionDbPath, createMcpServer } from "@dicelore/core";
import { parseUsage, DiceGm } from "./DiceGm.js";

describe("parseUsage（SDK usage 字段名 → 计量字段，纯函数）", () => {
  it("映射 input/output/cache token，缺省归零", () => {
    expect(parseUsage({
      input_tokens: 1200, output_tokens: 340,
      cache_read_input_tokens: 800, cache_creation_input_tokens: 64,
    })).toEqual({ inputTokens: 1200, outputTokens: 340, cacheReadTokens: 800, cacheCreationTokens: 64 });
  });
  it("缺 cache 维度 / undefined / 非数字 → 归零", () => {
    expect(parseUsage({ input_tokens: 10, output_tokens: 5 })).toEqual({
      inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0,
    });
    expect(parseUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 });
    expect(parseUsage({ input_tokens: "x", output_tokens: null })).toEqual({
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
    });
  });
});

describe("DiceGm.recordTurnUsage（采集落库，per-turn + per-agent）", () => {
  let prevXdg: string | undefined;
  let dataHome: string;

  beforeEach(() => {
    prevXdg = process.env.XDG_DATA_HOME;
    dataHome = mkdtempSync(join(tmpdir(), "dicelore-usage-"));
    process.env.XDG_DATA_HOME = dataHome;
  });
  afterEach(() => {
    if (prevXdg === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = prevXdg;
    rmSync(dataHome, { recursive: true, force: true });
  });

  // recordTurnUsage 是 private——经 as any 触达（采集点逻辑本身的单测，不走 LLM 的 runTurn）。
  function gmFor(sessionId: string, model?: string): DiceGm {
    const path = sessionDbPath(sessionId, "dice");
    mkdirSync(dirname(path), { recursive: true });
    const seedDb = openDb(path); initSchema(seedDb); seedDb.close();
    const mcpServer = createMcpServer(openDb(":memory:"), {});
    const gm = new DiceGm({ mcpServer, openingPrompt: "你是 GM。", skills: [], sessionId, model });
    return gm;
  }

  it("采到 result.usage → usage_log 落一行，挂 turnId/sessionId/agent='gm'/model", () => {
    const gm = gmFor("co-1", "glm-5.2");
    (gm as any).curTurnId = "turn-A";
    (gm as any).recordTurnUsage({
      input_tokens: 500, output_tokens: 120, cache_read_input_tokens: 300, cache_creation_input_tokens: 16,
    });
    const db = openDb(sessionDbPath("co-1", "dice")); initSchema(db);
    const rows = listUsage(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: "co-1", turnId: "turn-A", agent: "gm", model: "glm-5.2",
      inputTokens: 500, outputTokens: 120, cacheReadTokens: 300, cacheCreationTokens: 16,
    });
    db.close();
  });

  it("同一 turn 多次采集 → usageByTurn 聚合相加", () => {
    const gm = gmFor("co-2");
    (gm as any).curTurnId = "turn-B";
    (gm as any).recordTurnUsage({ input_tokens: 100, output_tokens: 40 });
    (gm as any).recordTurnUsage({ input_tokens: 25, output_tokens: 10 });
    const db = openDb(sessionDbPath("co-2", "dice")); initSchema(db);
    expect(usageByTurn(db, "turn-B")).toMatchObject({ inputTokens: 125, outputTokens: 50 });
    db.close();
  });

  it("无 sessionId 的 DiceGm 不采集（lore/裸测试不落库）", () => {
    const mcpServer = createMcpServer(openDb(":memory:"), {});
    const gm = new DiceGm({ mcpServer, openingPrompt: "x", skills: [] }); // 无 sessionId
    (gm as any).curTurnId = "t";
    expect(() => (gm as any).recordTurnUsage({ input_tokens: 1, output_tokens: 1 })).not.toThrow();
  });
});

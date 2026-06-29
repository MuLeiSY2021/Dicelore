// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// CO-采集：token 用量采集点单测。
// 不烧 LLM —— 拆两层验：① parseUsage 纯函数把 SDK result.usage 字段名映射成计量字段；
// ② usage 落库经端口:agent 上抛 {type:"usage"} TurnEvent → streamTurn/turnLoop 透传 onUsage →
//    DiceSession 经注入的 backend.recordUsage 落 usage_log(per-turn + per-agent,agent='gm')。
//    DiceGm 适配器本身不碰存储(storage-port Q3:agent 存储无关),故这里用「会一回合 yield usage 事件的
//    fake agent」驱动真 DiceSession,验证端到端落库,而非触达 DiceGm 私有方法。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, listUsage, usageByTurn, openSessionBackend, type DB } from "@dicelore/backend";
import type { Agent } from "@dicelore/harness";
import { DiceSession } from "./DiceSession.js";
import { parseUsage } from "./DiceGm.js";

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

describe("usage 落库经 DiceSession 端口（agent yield usage → backend.recordUsage）", () => {
  const memDb = (): DB => { const d = openDb(":memory:"); initSchema(d); return d; };
  // 一回合 yield 指定 usage 事件(+turn_end)的 fake agent——复刻 DiceGm 从 SDK result 取 usage 后的上抛。
  function usageAgent(usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number }, model?: string): Agent {
    return { async *runTurn() {
      yield { type: "usage", usage: { cacheReadTokens: 0, cacheCreationTokens: 0, ...usage }, model };
      yield { type: "turn_end" };
    } };
  }

  it("agent yield usage → usage_log 落一行,挂 turnId/sessionId/agent='gm'/model", async () => {
    const db = memDb();
    const host = new DiceSession("co-1", { db, backend: openSessionBackend(db),
      agentFactory: () => usageAgent({ inputTokens: 500, outputTokens: 120, cacheReadTokens: 300, cacheCreationTokens: 16 }, "glm-5.2") });
    const { turnId } = await host.handleMessage("跑一回合");
    const rows = listUsage(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessionId: "co-1", turnId, agent: "gm", model: "glm-5.2",
      inputTokens: 500, outputTokens: 120, cacheReadTokens: 300, cacheCreationTokens: 16,
    });
  });

  it("同一 turn 多次 yield usage → usageByTurn 聚合相加", async () => {
    const db = memDb();
    const host = new DiceSession("co-2", { db, backend: openSessionBackend(db),
      agentFactory: () => ({ async *runTurn() {
        yield { type: "usage", usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 0, cacheCreationTokens: 0 } };
        yield { type: "usage", usage: { inputTokens: 25, outputTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0 } };
        yield { type: "turn_end" };
      } }) as Agent });
    const { turnId } = await host.handleMessage("跑一回合");
    expect(usageByTurn(db, turnId)).toMatchObject({ inputTokens: 125, outputTokens: 50 });
  });
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 统一 session config（model-switch + spoiler-tiering）DiceSession 层单测：
//  · setConfig({model}) 设 pendingModel、当前回合仍用旧 currentModel，下回合起用新 model（下回合生效）。
//  · setConfig({spoilerTier}) 立即生效（getConfig 立刻读回）。
//  · GET 读回完整 config；部分更新只改传入字段。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend, type DB } from "@dicelore/backend";
import { DiceSession, type DiceSessionDeps } from "./DiceSession.js";
import { FakeDiceGm } from "./FakeDiceGm.js";
import type { AgentInit, Agent } from "../runtime/agent.js";

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };
function newDice(id: string, deps: Omit<DiceSessionDeps, "db" | "backend"> & { db?: DB }): DiceSession {
  const db = deps.db ?? memDb();
  return new DiceSession(id, { ...deps, db, backend: openSessionBackend(db) });
}

// 每回合捕获 buildInit() 里透传给 agent 的 model，验证下回合生效语义。
function capturingFactory(seen: (string | undefined)[]) {
  return (init: AgentInit): Agent => {
    seen.push(init.model);
    return new FakeDiceGm([{ type: "turn_end" }]);
  };
}

describe("DiceSession 统一 config（model-switch + spoiler-tiering）", () => {
  it("默认 config：model 回退默认、spoilerTier=strict、无 pendingModel", () => {
    const host = newDice("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const cfg = host.getConfig();
    expect(cfg.spoilerTier).toBe("strict");
    expect(cfg.model).toBeTruthy();
    expect(cfg.pendingModel).toBeUndefined();
  });

  it("deps.model 作 currentModel 初值回显", () => {
    const host = newDice("s1", { model: "glm-init", agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    expect(host.getConfig().model).toBe("glm-init");
  });

  it("POST config{model} 设 pendingModel；当前不变、下回合 currentModel 变（下回合生效）", async () => {
    const seen: (string | undefined)[] = [];
    const host = newDice("s1", { model: "glm-init", agentFactory: capturingFactory(seen) });

    // 切模型：设 pendingModel，currentModel 尚不变。
    host.setConfig({ model: "claude-haiku-4-5-20251001" });
    const afterSet = host.getConfig();
    expect(afterSet.model).toBe("glm-init"); // 当前回合仍用旧 model
    expect(afterSet.pendingModel).toBe("claude-haiku-4-5-20251001");

    // 下一回合 drive-turn 开始：pending 提升为 current。
    await host.handleMessage("走一步");
    expect(seen.at(-1)).toBe("claude-haiku-4-5-20251001"); // 本回合 agent 用新 model
    const afterTurn = host.getConfig();
    expect(afterTurn.model).toBe("claude-haiku-4-5-20251001");
    expect(afterTurn.pendingModel).toBeUndefined(); // pending 已消费清空
  });

  it("切模型后又一回合仍用新 model（不回退）", async () => {
    const seen: (string | undefined)[] = [];
    const host = newDice("s1", { model: "glm-init", agentFactory: capturingFactory(seen) });
    host.setConfig({ model: "m-new" });
    await host.handleMessage("回合一");
    await host.handleMessage("回合二");
    expect(seen).toEqual(["m-new", "m-new"]);
  });

  it("POST config{spoilerTier} 立即生效（getConfig 立刻读回）", () => {
    const host = newDice("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    host.setConfig({ spoilerTier: "off" });
    expect(host.getConfig().spoilerTier).toBe("off");
    host.setConfig({ spoilerTier: "loose" });
    expect(host.getConfig().spoilerTier).toBe("loose");
  });

  it("部分更新：只传 spoilerTier 不动 pendingModel，只传 model 不动 spoilerTier", () => {
    const host = newDice("s1", { model: "glm-init", agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    host.setConfig({ model: "m-pending" });
    host.setConfig({ spoilerTier: "off" });
    const cfg = host.getConfig();
    expect(cfg.pendingModel).toBe("m-pending"); // 未被 spoilerTier 更新清掉
    expect(cfg.spoilerTier).toBe("off");
    expect(cfg.model).toBe("glm-init"); // model 仍下回合生效
  });
});

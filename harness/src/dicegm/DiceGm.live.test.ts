// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 真 Agent SDK 冒烟(§0 de-risk smoke,裁决 skill-loading-by-reference §0「必过门」)。
// 默认 skip(烧 LLM);RUN_LIVE=1 + relay env 才跑。
//
// ⚠️ 可观测性缺口(记 backlog BE-diceGm-systeminit-event,待裁):
// §0 理想要断言「system init 消息的 skills 清单含 dicelore-gm-core + Skill 工具可调」,
// 但 DiceGm.runTurn 当前**不把 SDK system/init 消息暴露为 TurnEvent**(只 narration/usage/
// turn_end/error),且 logMsg 对 init 行砍掉 skills/plugins 字段。故本 smoke 只能断言 §0 ③
// 的下限:plugin 真装配 + 真回合被 SDK 接受、无加载 error 收束。要断言 §0 ①②须先给
// DiceGm 补一条 system_init TurnEvent(承重事件模型改动)。
const LIVE = process.env.RUN_LIVE === "1";

describe.skipIf(!LIVE)("DiceGm 真 SDK 冒烟(§0 必过门)", () => {
  it("plugin 按引用加载:真回合被 SDK 接受、无加载 error、收于 turn_end", async () => {
    const { openDb, initSchema, openSessionBackend } = await import("@dicelore/backend");
    const { createMcpServer } = await import("@dicelore/harness");
    const { DiceGm } = await import("./DiceGm.js");
    const { ensureDicePlugin } = await import("./openingPrompt.js");

    // 可写临时数据根:物化 dice 母本(gm-core + 4 flows)→ PluginRef。
    const dataRoot = mkdtempSync(join(tmpdir(), "dice-smoke-"));
    const plugin = ensureDicePlugin(dataRoot);
    expect(plugin).not.toBeNull();
    expect(plugin?.skills).toBe("all");

    const db = openDb(":memory:"); initSchema(db);
    const mcpServer = createMcpServer(openSessionBackend(db), db, {});
    const drv = new DiceGm({ mcpServer, openingPrompt: "你是 GM。用一句话开场。", plugin: plugin ?? undefined });
    const got: string[] = [];
    let errMsg: string | undefined;
    for await (const e of drv.runTurn({ text: "用一句话开场。" })) {
      got.push(e.type);
      if (e.type === "error") errMsg = (e as { message?: string }).message;
    }
    expect(errMsg, `不应有加载/运行 error: ${errMsg ?? ""}`).toBeUndefined();
    expect(got).toContain("turn_end");
  }, 120_000);
});

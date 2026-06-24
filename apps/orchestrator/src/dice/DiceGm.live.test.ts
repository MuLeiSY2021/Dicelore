// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";

// 真 Agent SDK 冒烟：默认 skip(烧 LLM);RUN_LIVE=1 + relay env 才跑。
const LIVE = process.env.RUN_LIVE === "1";

describe.skipIf(!LIVE)("DiceGm 真 SDK 冒烟", () => {
  it("跑一个真回合，至少产出 turn_end", async () => {
    const { openDb, initSchema, createMcpServer } = await import("@dicelore/core");
    const { DiceGm } = await import("./DiceGm.js");
    const db = openDb(":memory:"); initSchema(db);
    const mcpServer = createMcpServer(db, {});
    const drv = new DiceGm({ mcpServer, openingPrompt: "你是 GM。", skills: [] });
    const got: string[] = [];
    for await (const e of drv.runTurn({ text: "用一句话开场。" })) got.push(e.type);
    expect(got).toContain("turn_end");
  }, 120_000);
});

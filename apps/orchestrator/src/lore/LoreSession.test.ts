// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog, history, resolveId, commit } from "@dicelore/core";
import { LoreSession } from "./LoreSession.js";
import { FakeDiceGm } from "../dice/FakeDiceGm.js";

describe("LoreSession", () => {
  it("挂构建 MCP、无跑团插件字段;handleMessage 跑完一轮(REST,不广播)", async () => {
    const catalog = openCatalog(":memory:");
    let ran = 0;
    const host = new LoreSession("b1", {
      catalog, name: "凡人",
      agentFactory: () => new FakeDiceGm(() => { ran += 1; return [{ type: "narration", text: "已写入设定。" }, { type: "turn_end" }]; }),
    });
    expect(host.mcpServer).toBeTruthy();
    expect(host.kind).toBe("lore");
    expect((host as unknown as { gate?: unknown }).gate).toBeUndefined();
    expect((host as unknown as { db?: unknown }).db).toBeUndefined();
    // v1 REST only:无 WS 设施(hub/attachWs/detachWs 死代码已删)。
    expect((host as unknown as { hub?: unknown }).hub).toBeUndefined();
    expect((host as unknown as { attachWs?: unknown }).attachWs).toBeUndefined();

    // REST 语义:handleMessage 把 driver 跑完整轮(narration→turn_end)即收尾,resolve {turnId}。
    const { turnId } = await host.handleMessage("把第一章设定写进去");
    expect(ran).toBe(1);
    expect(turnId).toMatch(/^b1-l\d+$/);
    catalog.close();
  });

  it("draft 经构建工具累积可 commit 到 catalog", () => {
    const catalog = openCatalog(":memory:");
    const host = new LoreSession("b2", { catalog, name: "魔道", agentFactory: () => new FakeDiceGm([]) });
    // 直接驱动 draft(模拟 agent 调构建工具后)
    host.draft.setManifest({ name: "魔道", id: "md" });
    host.draft.writeLore("入侵", "魔道压境");
    const r = commit(catalog, { name: "魔道", files: host.draft.toPackFiles(), message: "init", createdAt: "2026-01-01" });
    expect(r.tuanbenId).toBe(resolveId("魔道"));
    expect(history(catalog, r.tuanbenId).length).toBe(1);
    catalog.close();
  });
});

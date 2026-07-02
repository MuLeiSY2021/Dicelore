// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog, history, resolveId, commit, createBuildMcpServer, Draft } from "@dicelore/backend";
import { LoreSession } from "./LoreSession.js";
import type { AgentInit, PluginRef } from "../runtime/agent.js";
import { FakeDiceGm } from "../dicegm/FakeDiceGm.js";

describe("LoreSession", () => {
  it("挂注入的构建 MCP、无跑团插件字段;handleMessage 跑完一轮(REST,不广播)", async () => {
    const catalog = openCatalog(":memory:");
    // 组合根侧:建 Draft + 构建 MCP server 注入(loregm 不自建 Draft/不 import createBuildMcpServer)。
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    let ran = 0;
    const host = new LoreSession("b1", {
      mcpServer,
      agentFactory: () => new FakeDiceGm(() => { ran += 1; return [{ type: "narration", text: "已写入设定。" }, { type: "turn_end" }]; }),
    });
    expect(host.mcpServer).toBeTruthy();
    expect(host.kind).toBe("lore");
    expect((host as unknown as { gate?: unknown }).gate).toBeUndefined();
    expect((host as unknown as { db?: unknown }).db).toBeUndefined();
    // v1 REST only:无 WS 设施(hub/attachWs/detachWs 死代码已删)。
    expect((host as unknown as { hub?: unknown }).hub).toBeUndefined();
    expect((host as unknown as { attachWs?: unknown }).attachWs).toBeUndefined();
    // Draft 不再由 LoreSession 持有(组合根持有);loregm 保持 backend-free。
    expect((host as unknown as { draft?: unknown }).draft).toBeUndefined();

    // REST 语义:handleMessage 把 driver 跑完整轮(narration→turn_end)即收尾,resolve {turnId}。
    const r = await host.handleMessage("把第一章设定写进去");
    expect(ran).toBe(1);
    expect(r.turnId).toMatch(/^b1-l\d+$/);
    // 成功轮:不带 error。
    expect(r.error).toBeUndefined();
    catalog.close();
  });

  // §2 BE-lore-test-gap:投递断言——agentFactory 捕获传入的 AgentInit,断言 buildPrompt 透传为
  // init.openingPrompt、plugin 透传(迁移后为 PluginRef,见 skill-loading-by-reference)。
  it("handleMessage 把 buildPrompt/plugin 透传进 agentFactory 的 AgentInit(投递路径)", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const inits: AgentInit[] = [];
    const plugin: PluginRef = { pluginDir: "/data/lore", skills: "all" };
    const host = new LoreSession("b2", {
      mcpServer,
      buildPrompt: "你是团本构建 GM。",
      plugin,
      agentFactory: (init) => { inits.push(init); return new FakeDiceGm([{ type: "turn_end" }]); },
    });
    await host.handleMessage("写点设定");
    expect(inits.length).toBe(1);
    expect(inits[0].mcpServer).toBe(mcpServer);
    expect(inits[0].openingPrompt).toBe("你是团本构建 GM。"); // buildPrompt → openingPrompt
    expect(inits[0].plugin).toEqual(plugin); // plugin 透传
    catalog.close();
  });

  // §1 BE-lore-error-shape:构建 agent 中途 error(FakeDiceGm error 档)→ handleMessage 返回带 error、不吞。
  it("agent 产 error 事件时 handleMessage 返回 {turnId, error}(不吞)", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const host = new LoreSession("b3", {
      mcpServer,
      agentFactory: () => new FakeDiceGm([
        { type: "narration", text: "开始写设定……" },
        { type: "error", message: "工具调用失败", code: "tool_error" },
      ]),
    });
    const r = await host.handleMessage("写点设定");
    expect(r.turnId).toMatch(/^b3-l\d+$/);
    expect(r.error).toEqual({ message: "工具调用失败", code: "tool_error" });
    catalog.close();
  });

  it("error 事件无 code 时 error.code 为 undefined", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const host = new LoreSession("b4", {
      mcpServer,
      agentFactory: () => new FakeDiceGm([{ type: "error", message: "GM 挂了" }]),
    });
    const r = await host.handleMessage("写点设定");
    expect(r.error).toEqual({ message: "GM 挂了", code: undefined });
    catalog.close();
  });

  it("draft 经构建工具累积可 commit 到 catalog(Draft 由组合根持有)", () => {
    const catalog = openCatalog(":memory:");
    // 组合根持 Draft(LoreSession 不再持);此处直接驱动 Draft 模拟 agent 调构建工具后的态。
    const draft = new Draft();
    draft.setManifest({ name: "魔道", id: "md" });
    draft.writeLore("入侵", "魔道压境");
    const r = commit(catalog, { name: "魔道", files: draft.toPackFiles(), message: "init", createdAt: "2026-01-01" });
    expect(r.adventureId).toBe(resolveId("魔道"));
    expect(history(catalog, r.adventureId).length).toBe(1);
    catalog.close();
  });
});

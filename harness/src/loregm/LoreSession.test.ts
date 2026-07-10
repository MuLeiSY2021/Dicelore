// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCatalog, history, resolveId, commit, createBuildMcpServer, Draft } from "@dicelore/backend";
import { LoreSession } from "./LoreSession.js";
import type { Agent, AgentInit, PluginRef, TurnEvent, TurnInput } from "../runtime/agent.js";
import { FakeDiceGm } from "../dicegm/FakeDiceGm.js";
import { SessionTranscript, sessionDir } from "../runtime/transcript.js";

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

  it("handleMessage 把 sessionId + sessionsDir(=dataDir) + kind:'lore' 透传进 AgentInit(可观测性接线)", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const inits: AgentInit[] = [];
    const host = new LoreSession("bt", {
      mcpServer,
      dataDir: "/data/root",
      agentFactory: (init) => { inits.push(init); return new FakeDiceGm([{ type: "turn_end" }]); },
    });
    await host.handleMessage("写点设定");
    expect(inits.length).toBe(1);
    expect(inits[0].sessionId).toBe("bt");
    expect(inits[0].sessionsDir).toBe("/data/root"); // dataDir → AgentInit.sessionsDir
    expect(inits[0].kind).toBe("lore");
    catalog.close();
  });

  it("dataDir 省略时 AgentInit.sessionsDir 为 undefined(退化:不落 transcript)", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const inits: AgentInit[] = [];
    const host = new LoreSession("bt2", {
      mcpServer,
      agentFactory: (init) => { inits.push(init); return new FakeDiceGm([{ type: "turn_end" }]); },
    });
    await host.handleMessage("写点设定");
    expect(inits[0].sessionsDir).toBeUndefined();
    expect(inits[0].kind).toBe("lore");
    catalog.close();
  });

  // 端到端(fake 适配器复刻 DiceGm transcript 行为):跑一轮后 loregm 落
  // <dataDir>/sessions/lore/<id>/<id>_session.jsonl,含 _:'turn'(作者 text) + _:'msg';REST 仍只返 {turnId}。
  it("跑一轮后落 <dataDir>/sessions/lore/<id>/<id>_session.jsonl(含 turn+msg),handleMessage 仍返 {turnId}", async () => {
    const root = mkdtempSync(join(tmpdir(), "dl-lore-jsonl-"));
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    // 适配器测试替身:据 AgentInit 建 kind:'lore' 的 SessionTranscript(路径 sessionDir(dataDir,'lore',id)),
    // 落回合头(_:'turn',带作者 text)+ 一条 msg,复刻 DiceGm 的带外落盘(loregm 本身不碰 transcript)。
    class TranscriptFakeGm implements Agent {
      constructor(private init: AgentInit) {}
      async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
        const dir = sessionDir(this.init.sessionsDir!, this.init.kind ?? "dice", this.init.sessionId!);
        const t = new SessionTranscript({ sessionDir: dir, sessionId: this.init.sessionId! });
        t.turn({ turnId: input.turnId, sessionId: this.init.sessionId, input: input.text });
        t.msg(1, { _: "msg", turnId: input.turnId, text: "已写入设定。" });
        t.turnEnd(input.turnId ?? "?");
        yield { type: "turn_end" };
      }
    }
    try {
      const host = new LoreSession("jl1", {
        mcpServer,
        dataDir: root,
        agentFactory: (init) => new TranscriptFakeGm(init),
      });
      const r = await host.handleMessage("把第一章设定写进去");
      // REST 不变:只返 {turnId}(jsonl 带外落盘)。
      expect(r.turnId).toMatch(/^jl1-l\d+$/);
      expect(r.error).toBeUndefined();

      const jsonlPath = join(sessionDir(root, "lore", "jl1"), "jl1_session.jsonl");
      expect(existsSync(jsonlPath)).toBe(true);
      const raw = readFileSync(jsonlPath, "utf8").trim();
      expect(raw.length).toBeGreaterThan(0); // 非空
      const lines = raw.split("\n").map((l) => JSON.parse(l) as { _?: string; input?: string });
      const turnLine = lines.find((l) => l._ === "turn");
      expect(turnLine).toBeTruthy();
      expect(turnLine!.input).toBe("把第一章设定写进去"); // 作者 text 进 turn 头
      expect(lines.some((l) => l._ === "msg")).toBe(true);
    } finally {
      catalog.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  // usage-stream §3:driver 产 usage 事件 → handleMessage 累加本轮四类 token、返回含 usage(v1 不落库)。
  it("driver 产 usage 事件时 handleMessage 返回含 usage(四类 token 之和)", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const host = new LoreSession("bu1", {
      mcpServer,
      agentFactory: () => new FakeDiceGm([
        { type: "usage", usage: { inputTokens: 8, outputTokens: 2, cacheReadTokens: 1, cacheCreationTokens: 0 } },
        { type: "usage", usage: { inputTokens: 2, outputTokens: 3, cacheReadTokens: 0, cacheCreationTokens: 5 } },
        { type: "turn_end" },
      ]),
    });
    const r = await host.handleMessage("写点设定");
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheCreationTokens: 5 });
    expect(r.error).toBeUndefined();
    catalog.close();
  });

  it("无 usage 事件时 handleMessage 返回不含 usage", async () => {
    const catalog = openCatalog(":memory:");
    const draft = new Draft();
    const mcpServer = createBuildMcpServer({ catalog, draft, name: "凡人" });
    const host = new LoreSession("bu2", {
      mcpServer,
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "写好了" }, { type: "turn_end" }]),
    });
    const r = await host.handleMessage("写点设定");
    expect(r.usage).toBeUndefined();
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

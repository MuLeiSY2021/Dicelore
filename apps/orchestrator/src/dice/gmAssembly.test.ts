// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, createMcpServer } from "@dicelore/core";
import { buildQueryOptions } from "./gmAssembly.js";

// TB-2：SDK 装配的 offline 回归网。
//
// 背景：DiceGm.runTurn 调真 @anthropic-ai/claude-agent-sdk 的 query()，live.test.ts 默认 skip(烧 LLM)，
// 真 SDK 装配路径(options 构建、MCP 挂载、settingSources/allowedTools 门控、systemPrompt/model)零回归保护。
// 这里把装配逻辑抽成纯函数 buildQueryOptions 后，不调 query()、不连 LLM 即可断言装配正确性。
//
// 本文件只 import gmAssembly(不 import DiceGm)——故不会拉入未安装运行时的 SDK 包，纯 offline。
describe("buildQueryOptions（SDK 装配 offline 回归 / TB-2）", () => {
  // 真 McpServer 实例(同 live.test.ts 的造法)，断言它被原样挂到 mcpServers.dicelore.instance。
  function makeMcp() {
    const db = openDb(":memory:");
    initSchema(db);
    return createMcpServer(db, {});
  }

  it("MCP 以 sdk 类型挂在 dicelore 槽位，instance 即传入的 mcpServer", () => {
    const mcpServer = makeMcp();
    const ctrl = new AbortController();
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer,
      openingPrompt: "你是 GM。",
      staged: undefined,
      abortController: ctrl,
    });
    expect(opts.mcpServers.dicelore.type).toBe("sdk");
    expect(opts.mcpServers.dicelore.name).toBe("dicelore");
    expect(opts.mcpServers.dicelore.instance).toBe(mcpServer); // 同一实例(in-process 缝)
  });

  it("model / systemPrompt / abortController 取自入参(透传，不被装配逻辑改写)", () => {
    const mcpServer = makeMcp();
    const ctrl = new AbortController();
    const opts = buildQueryOptions({
      model: "some-custom-model",
      mcpServer,
      openingPrompt: "SIGNPOST+教条+prologue",
      staged: undefined,
      abortController: ctrl,
    });
    expect(opts.model).toBe("some-custom-model");
    expect(opts.systemPrompt).toBe("SIGNPOST+教条+prologue");
    expect(opts.abortController).toBe(ctrl); // 同一 controller → 超时 abort 才能生效
  });

  describe("staged 为空（无 skill，走 ADR-0020 settingSources:[]）", () => {
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer: makeMcp(),
      openingPrompt: "你是 GM。",
      staged: undefined,
      abortController: new AbortController(),
    });
    it("settingSources 为空数组(不读本地 .claude)", () => {
      expect(opts.settingSources).toEqual([]);
    });
    it("不设置 cwd", () => {
      expect(opts.cwd).toBeUndefined();
      expect("cwd" in opts).toBe(false); // 字段本身不出现，而非 = undefined
    });
    it("allowedTools 只放 mcp__dicelore(不放 Skill/Read)", () => {
      expect(opts.allowedTools).toEqual(["mcp__dicelore"]);
    });
  });

  describe("staged 非空（有 skill，读副本 cwd 的 .claude）", () => {
    const STAGED = "/tmp/dg-staged-42";
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer: makeMcp(),
      openingPrompt: "你是 GM。",
      staged: STAGED,
      abortController: new AbortController(),
    });
    it("settingSources 为 ['project'](读 staged 副本 cwd 的 .claude)", () => {
      expect(opts.settingSources).toEqual(["project"]);
    });
    it("cwd 指向 staged 副本目录", () => {
      expect(opts.cwd).toBe(STAGED);
    });
    it("allowedTools 放开 Skill/Read 供 agent 自助查阅 skill(渐进披露)", () => {
      expect(opts.allowedTools).toEqual(["mcp__dicelore", "Skill", "Read"]);
    });
  });

  it("staged 切换只改 settingSources/cwd/allowedTools 三处，MCP 装配两档一致", () => {
    const mcpServer = makeMcp();
    const base = { model: "glm-5.2", mcpServer, openingPrompt: "p", abortController: new AbortController() };
    const off = buildQueryOptions({ ...base, staged: undefined });
    const on = buildQueryOptions({ ...base, staged: "/tmp/dg-staged-7" });
    // MCP 挂载与 staged 与否无关(始终同一 in-process server)。
    expect(off.mcpServers).toEqual(on.mcpServers);
    expect(off.mcpServers.dicelore.instance).toBe(on.mcpServers.dicelore.instance);
  });
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { createMcpServer } from "@dicelore/harness";
import { CONTEXT_WINDOW, contextWindowFor } from "@dicelore/shared";
import { buildQueryOptions } from "./gmAssembly.js";
import type { PluginRef } from "../runtime/agent.js";

// TB-2：SDK 装配的 offline 回归网。
//
// 背景：DiceGm.runTurn 调真 @anthropic-ai/claude-agent-sdk 的 query()，live.test.ts 默认 skip(烧 LLM)，
// 真 SDK 装配路径(options 构建、MCP 挂载、plugins/skills 门控、allowedTools 门控、systemPrompt/model)零回归保护。
// 这里把装配逻辑抽成纯函数 buildQueryOptions 后，不调 query()、不连 LLM 即可断言装配正确性。
//
// skill 加载改「local plugin 按引用 + skills 开关」(裁决 skill-loading-by-reference §3)：
// plugin 非空 → plugins:[{type:'local',path}] + skills；plugin 空 → skills:[]/无 plugins(baseline)。
// allowedTools 去 'Skill'(已废弃)。settingSources 恒 []。workspace 非空 → cwd=workspace + 放开文件工具。
describe("buildQueryOptions（SDK 装配 offline 回归 / TB-2）", () => {
  function makeMcp() {
    const db = openDb(":memory:");
    initSchema(db);
    return createMcpServer(openSessionBackend(db), db, {});
  }

  const DICE_PLUGIN: PluginRef = { pluginDir: "/data/dice", skills: "all" };

  it("MCP 以 sdk 类型挂在 dicelore 槽位，instance 即传入的 mcpServer", () => {
    const mcpServer = makeMcp();
    const ctrl = new AbortController();
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer,
      openingPrompt: "你是 GM。",
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
      openingPrompt: "SIGNPOST+prologue",
      abortController: ctrl,
    });
    expect(opts.model).toBe("some-custom-model");
    expect(opts.systemPrompt).toBe("SIGNPOST+prologue");
    expect(opts.abortController).toBe(ctrl); // 同一 controller → 超时 abort 才能生效
  });

  it("settingSources 恒为空数组(不读盘上 settings;plugins 正交加载)", () => {
    const off = buildQueryOptions({ model: "m", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });
    const on = buildQueryOptions({ model: "m", mcpServer: makeMcp(), openingPrompt: "p", plugin: DICE_PLUGIN, abortController: new AbortController() });
    expect(off.settingSources).toEqual([]);
    expect(on.settingSources).toEqual([]);
  });

  // 裁决 usage-and-context C1：经 flag settings 层显式开 auto-compact（与 settingSources:[] 正交）。
  describe("auto-compact settings 注入（C1 / usage-and-context）", () => {
    it("显式 autoCompactEnabled:true（不依赖 SDK 默认）", () => {
      const opts = buildQueryOptions({ model: "claude-opus-4-8", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });
      expect(opts.settings.autoCompactEnabled).toBe(true);
    });
    it("autoCompactWindow = CONTEXT_WINDOW[model]（与 foot 占用% 同口径）", () => {
      const opts = buildQueryOptions({ model: "claude-opus-4-8", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });
      expect(opts.settings.autoCompactWindow).toBe(CONTEXT_WINDOW["claude-opus-4-8"]);
    });
    it("未知 model → autoCompactWindow 落 default 窗口", () => {
      const opts = buildQueryOptions({ model: "glm-5.2", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });
      expect(opts.settings.autoCompactWindow).toBe(contextWindowFor("glm-5.2"));
      expect(opts.settings.autoCompactWindow).toBe(CONTEXT_WINDOW.default);
    });
    it("settings 与 settingSources:[] 正交并存（都装配，互不覆盖）", () => {
      const opts = buildQueryOptions({ model: "m", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });
      expect(opts.settingSources).toEqual([]);
      expect(opts.settings).toEqual({ autoCompactEnabled: true, autoCompactWindow: CONTEXT_WINDOW.default });
    });
  });

  describe("plugin 为空（baseline：skill 全不启）", () => {
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer: makeMcp(),
      openingPrompt: "你是 GM。",
      abortController: new AbortController(),
    });
    it("skills 为空数组、不装 plugins", () => {
      expect(opts.skills).toEqual([]);
      expect(opts.plugins).toBeUndefined();
      expect("plugins" in opts).toBe(false);
    });
    it("不设置 cwd(dice 无 workspace)", () => {
      expect(opts.cwd).toBeUndefined();
      expect("cwd" in opts).toBe(false);
    });
    it("allowedTools = mcp__dicelore + Read(不含 Skill)", () => {
      expect(opts.allowedTools).toEqual(["mcp__dicelore", "Read"]);
      expect(opts.allowedTools).not.toContain("Skill");
    });
  });

  describe("plugin 非空（local plugin 按引用 + skills 开关）", () => {
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer: makeMcp(),
      openingPrompt: "你是 GM。",
      plugin: DICE_PLUGIN,
      abortController: new AbortController(),
    });
    it("plugins = [{type:'local', path: plugin.pluginDir}]", () => {
      expect(opts.plugins).toEqual([{ type: "local", path: "/data/dice" }]);
    });
    it("skills = plugin.skills", () => {
      expect(opts.skills).toBe("all");
    });
    it("allowedTools 仍不含 Skill(已废弃,skills 选项接管开关)", () => {
      expect(opts.allowedTools).not.toContain("Skill");
      expect(opts.allowedTools).toEqual(["mcp__dicelore", "Read"]);
    });
  });

  describe("workspace 非空（lore build-agent-workspace）", () => {
    const WS = "/data/lore/sessions/l1/workspace";
    const opts = buildQueryOptions({
      model: "glm-5.2",
      mcpServer: makeMcp(),
      openingPrompt: "构建 prompt",
      plugin: { pluginDir: "/data/lore", skills: "all" },
      workspace: WS,
      abortController: new AbortController(),
    });
    it("cwd = workspace", () => {
      expect(opts.cwd).toBe(WS);
    });
    it("allowedTools 放开素材工作区文件工具(Bash/Grep/Glob/Write/Edit)", () => {
      expect(opts.allowedTools).toEqual(["mcp__dicelore", "Read", "Bash", "Grep", "Glob", "Write", "Edit"]);
      expect(opts.allowedTools).not.toContain("Skill");
    });
    it("plugins/skills 仍按 plugin 装配", () => {
      expect(opts.plugins).toEqual([{ type: "local", path: "/data/lore" }]);
      expect(opts.skills).toBe("all");
    });
  });

  it("plugin 切换只改 plugins/skills，MCP 装配两档一致", () => {
    const mcpServer = makeMcp();
    const base = { model: "glm-5.2", mcpServer, openingPrompt: "p", abortController: new AbortController() };
    const off = buildQueryOptions({ ...base });
    const on = buildQueryOptions({ ...base, plugin: DICE_PLUGIN });
    expect(off.mcpServers).toEqual(on.mcpServers);
    expect(off.mcpServers.dicelore.instance).toBe(on.mcpServers.dicelore.instance);
  });

  // gm-session-continuity：一个团本一个 SDK session——resume 透传。
  // 首回合(无 sdk_session_id)省略 resume(SDK 开新 session);后续回合注入 sdk_session_id → base.resume。
  describe("resume 透传（gm-session-continuity）", () => {
    const base = () => ({ model: "glm-5.2", mcpServer: makeMcp(), openingPrompt: "p", abortController: new AbortController() });

    it("首回合(无 resume) → options 不含 resume 键(SDK 开新 session)", () => {
      const opts = buildQueryOptions({ ...base() });
      expect(opts.resume).toBeUndefined();
      expect("resume" in opts).toBe(false);
    });

    it("第二回合(resume 非空) → options.resume = 传入的 sdk_session_id", () => {
      const opts = buildQueryOptions({ ...base(), resume: "sdk-sess-abc123" });
      expect(opts.resume).toBe("sdk-sess-abc123");
    });

    it("空串 resume 视同无值 → 省略(不传空串给 SDK)", () => {
      const opts = buildQueryOptions({ ...base(), resume: "" });
      expect("resume" in opts).toBe(false);
    });
  });
});

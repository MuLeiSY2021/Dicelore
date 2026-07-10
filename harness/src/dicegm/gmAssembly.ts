// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PluginRef } from "../runtime/agent.js";
import { contextWindowFor } from "@dicelore/shared";

// ── SDK query() 的 options 纯装配(TB-2) ────────────────────────────────────
// 把「构建 query() 的 options」从 DiceGm.runTurn 里抽出来，使其成为一个**不调 query()、
// 不碰 LLM、不读文件**的纯函数 —— 这样真 SDK 装配路径(MCP 挂载/plugins/skills 门控/
// allowedTools 门控/systemPrompt/model)在无 LLM 模式下也能跑装配断言，零回归保护。
//
// skill 加载改「local plugin 按引用 + skills 开关」(裁决 skill-loading-by-reference §3):
//  · plugin 非空 → plugins:[{type:'local',path:plugin.pluginDir}] + skills:plugin.skills;
//    plugin 空 → 省略 plugins、skills:[](baseline:skill 全不启)。
//  · allowedTools 去掉 'Skill'(SDK 已废弃,skills 选项接管开关):dice=["mcp__dicelore","Read"];
//    workspace 非空(lore)= 放开 Bash/Grep/… 供素材工作区操作。
//  · settingSources 恒 [](不读盘上 settings;plugins 与之正交、照常加载)。
//  · cwd:workspace 非空 → workspace;否则省略(dice 用 SDK 默认 process.cwd())。

// query() options 里我们实际装配的子集(结构化，避免依赖未安装的 SDK 运行时包)。
// DiceGm 在调用点把它 as 成 Parameters<typeof query>[0]["options"]。
export interface GmQueryOptions {
  model: string;
  settingSources: ("project" | "user" | "local")[];
  cwd?: string;
  resume?: string; // SDK session 续接(裁决 gm-session-continuity):非空→SDK 加载该 session 历史;省略→开新 session
  // SDK flag settings 层（sdk.d.ts Options.settings，最高优先级、与 settingSources:[] 正交）——
  // 裁决 usage-and-context C1：显式注入 auto-compact 开关，让上下文接近窗口上限时 SDK 自动 summarize 旧回合。
  settings: { autoCompactEnabled: boolean; autoCompactWindow: number };
  plugins?: { type: "local"; path: string }[];
  skills?: string[] | "all";
  mcpServers: {
    dicelore: { type: "sdk"; name: "dicelore"; instance: McpServer };
  };
  systemPrompt: string;
  allowedTools: string[];
  abortController: AbortController;
}

export interface BuildQueryOptionsArgs {
  model: string;
  mcpServer: McpServer;
  openingPrompt: string;
  plugin?: PluginRef; // skill plugin 引用(空=不启 skill,baseline)
  workspace?: string; // 素材工作区 cwd(lore build-agent-workspace 用;空=SDK 默认 cwd)
  resume?: string; // SDK session_id 续接(裁决 gm-session-continuity):透传进 base.resume,首回合无值→省略
  abortController: AbortController;
}

// 装配 query() 的 options。纯函数：输入全显式、无副作用、不调 query()/不碰 LLM。
export function buildQueryOptions(args: BuildQueryOptionsArgs): GmQueryOptions {
  const { model, mcpServer, openingPrompt, plugin, workspace, resume, abortController } = args;
  const base: GmQueryOptions = {
    model,
    settingSources: [], // 不读盘上 settings;plugins 正交加载
    // C1(裁决 usage-and-context)：经 flag settings 层显式开 auto-compact；autoCompactWindow 与 foot 占用%
    // 同口径（CONTEXT_WINDOW[model]）。显式 true 不依赖 SDK 默认；运行时开关 v1 不暴露前端。
    settings: { autoCompactEnabled: true, autoCompactWindow: contextWindowFor(model) },
    ...(workspace ? { cwd: workspace } : {}),
    ...(resume ? { resume } : {}), // 首回合无 resume → 省略(SDK 开新 session);后续注入 sdk_session_id 续接历史
    ...(plugin ? { plugins: [{ type: "local", path: plugin.pluginDir }] } : {}),
    skills: plugin ? plugin.skills : [], // plugin 空 → skills:[](baseline)
    mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: mcpServer } },
    systemPrompt: openingPrompt,
    // allowedTools 去 'Skill'(已废弃);workspace 非空(lore)放开素材工作区文件工具。
    allowedTools: workspace
      ? ["mcp__dicelore", "Read", "Bash", "Grep", "Glob", "Write", "Edit"]
      : ["mcp__dicelore", "Read"],
    abortController,
  };
  return base;
}

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

// 客制 MCP（裁决 custom-mcp-install）运行时按 stdio 拉起：与核心 dicelore(sdk) 并列挂进 mcpServers。
// 组合根经 resolveCustomMcpServers(config.toml) 解析 enabled&&installed 的项后注入。
export interface StdioMcpConfig {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}
type SdkMcpEntry = { type: "sdk"; name: "dicelore"; instance: McpServer };

export interface GmQueryOptions {
  model: string;
  settingSources: ("project" | "user" | "local")[];
  cwd?: string;
  resume?: string; // SDK session 续接(裁决 gm-session-continuity):非空→SDK 加载该 session 历史;省略→开新 session
  plugins?: { type: "local"; path: string }[];
  skills?: string[] | "all";
  // 核心 dicelore(in-process sdk) 恒在;客制 out-of-canon MCP(stdio) 按 key=实例名并列注入。
  mcpServers: { dicelore: SdkMcpEntry } & Record<string, SdkMcpEntry | StdioMcpConfig>;
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
  // 客制 MCP(裁决 custom-mcp-install):组合根按 config.toml 解析出的 stdio 配置表(key=实例名);
  // 空/省略=只挂核心 dicelore(行为不变)。
  customMcpServers?: Record<string, StdioMcpConfig>;
  abortController: AbortController;
}

// 装配 query() 的 options。纯函数：输入全显式、无副作用、不调 query()/不碰 LLM。
export function buildQueryOptions(args: BuildQueryOptionsArgs): GmQueryOptions {
  const { model, mcpServer, openingPrompt, plugin, workspace, resume, customMcpServers, abortController } = args;
  // 客制 MCP(裁决 custom-mcp-install):stdio 项与核心 dicelore 并列挂;其工具经 allowedTools 放行
  // (SDK 工具命名空间 mcp__<实例名>)——这即「工具表合并」，客制工具的 out-of-canon 徽由前端据 config 呈现。
  const customServers = customMcpServers ?? {};
  const customToolAllows = Object.keys(customServers).map((name) => `mcp__${name}`);
  const baseAllowed = workspace
    ? ["mcp__dicelore", "Read", "Bash", "Grep", "Glob", "Write", "Edit"]
    : ["mcp__dicelore", "Read"];
  const base: GmQueryOptions = {
    model,
    settingSources: [], // 不读盘上 settings;plugins 正交加载
    ...(workspace ? { cwd: workspace } : {}),
    ...(resume ? { resume } : {}), // 首回合无 resume → 省略(SDK 开新 session);后续注入 sdk_session_id 续接历史
    ...(plugin ? { plugins: [{ type: "local", path: plugin.pluginDir }] } : {}),
    skills: plugin ? plugin.skills : [], // plugin 空 → skills:[](baseline)
    mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: mcpServer }, ...customServers },
    systemPrompt: openingPrompt,
    // allowedTools 去 'Skill'(已废弃);workspace 非空(lore)放开素材工作区文件工具;客制 MCP 工具命名空间放行。
    allowedTools: [...baseAllowed, ...customToolAllows],
    abortController,
  };
  return base;
}

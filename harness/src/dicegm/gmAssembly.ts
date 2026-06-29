// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── SDK query() 的 options 纯装配(TB-2) ────────────────────────────────────
// 把「构建 query() 的 options」从 DiceGm.runTurn 里抽出来，使其成为一个**不调 query()、
// 不碰 LLM、不读文件**的纯函数 —— 这样真 SDK 装配路径(MCP 挂载/settingSources 门控/
// allowedTools 门控/systemPrompt/model)在无 LLM 模式下也能跑装配断言，零回归保护。
//
// 边界自决：
//  · 进纯函数 —— 一切「确定性地由 (init,model,staged,controller) 推出 options 字段」的逻辑。
//    它们不依赖 LLM、不依赖 I/O，是真正"会被改坏却又测不到"的装配缝。
//  · 留 runTurn —— model 解析(读 env)、stageSkills(写盘 I/O)、timeout/AbortController 生命周期、
//    query() 调用与消息流消费。这些含副作用/外部交互，不属于纯装配，留在 runTurn。
//  · env 鉴权(ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN)由 SDK 原生读 process.env，
//    DiceGm 本就不显式装配，故不进本函数(无可断言的装配点)。

// query() options 里我们实际装配的子集(结构化，避免依赖未安装的 SDK 运行时包)。
// DiceGm 在调用点把它 as 成 Parameters<typeof query>[0]["options"]。
export interface GmQueryOptions {
  model: string;
  settingSources: ("project" | "user" | "local")[];
  cwd?: string;
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
  staged: string | undefined; // stageSkills 产出的会话本地副本 cwd(空=不读本地)
  abortController: AbortController;
}

// 装配 query() 的 options。纯函数：输入全显式、无副作用、不调 query()/不碰 LLM。
//
// staged 语义(沿 DiceGm 原注释 + ADR-0020):
//  · staged 非空 → settingSources:["project"] 读副本 cwd 的 .claude(渐进披露 skill)，
//    cwd=staged，allowedTools 放开 Skill/Read 供 agent 自助查阅 skill。
//  · staged 为空 → settingSources:[] 不读本地，无 cwd，allowedTools 只留 mcp__dicelore。
export function buildQueryOptions(args: BuildQueryOptionsArgs): GmQueryOptions {
  const { model, mcpServer, openingPrompt, staged, abortController } = args;
  return {
    model,
    settingSources: staged ? ["project"] : [], // staged 时读副本 cwd 的 .claude;否则不读本地
    ...(staged ? { cwd: staged } : {}),
    mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: mcpServer } },
    systemPrompt: openingPrompt,
    allowedTools: staged ? ["mcp__dicelore", "Skill", "Read"] : ["mcp__dicelore"],
    abortController,
  };
}

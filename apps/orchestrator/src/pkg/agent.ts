// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface TurnInput { text: string; turnId?: string }

export type TurnEvent =
  | { type: "narration"; text: string } // 一段散文(Phase 1 = narrate 工具调用粒度)
  | { type: "turn_end" } // GM 本回合自然结束
  | { type: "error"; message: string }; // 驱动/SDK 错误

export interface Agent {
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}

// ── Agent 适配缝(spec AD-1) ──
// 任意 agent/harness 经 AgentFactory 适配进架构;CC SDK(DiceGm)是首个适配器。
// AgentInit = 起一个会话 agent 所需的全部:in-process MCP + 系统提示 + 会话本地 skill + 模型。
export interface SkillRef {
  name: string; // skill 名(= staged 目录名,如 dicelore-gm-core)
  srcDir: string; // 源 skill 目录(只读;staged 时整目录拷贝)
}

export interface AgentInit {
  mcpServer: McpServer; // 会话 in-process MCP(已注入回调/gate)
  openingPrompt: string; // 系统提示(dice=signpost+教条+prologue;lore=构建prompt)
  skills: SkillRef[]; // 会话本地 staged skill 副本(空=不 stage,走 settingSources:[])
  model?: string; // 默认由 env / 适配器内定
  sessionId?: string; // GM raw 日志用:标识会话(日志文件名)
  sessionsDir?: string; // GM raw 日志用:sessions 根目录(日志落 <dir>/dicelore/sessions/<id>.gm.log)
}

export type AgentFactory = (init: AgentInit) => Agent;

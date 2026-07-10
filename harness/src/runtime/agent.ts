// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionBackend } from "@dicelore/interface";

export interface TurnInput { text: string; turnId?: string }

// fake lore 构建驱动写 Draft 的通道(结构化返回,不耦合 backend 的 Draft/Envelope 类型)。
// 组合根(api/lore)注入 = (name,args) => invokeBuildTool(ctx,name,args);真 DiceGm/FakeDiceGm 忽略。
export type BuildInvoke = (name: string, args: unknown) => { isError?: boolean };

// 一回合 token 用量(SDK result.usage 解析后的四类计数)。agent 适配器只上抛,
// 不碰存储;落库由会话经注入的 SessionBackend.recordUsage 做(storage-port:agent 存储无关)。
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export type TurnEvent =
  | { type: "narration"; text: string } // 一段散文(Phase 1 = narrate 工具调用粒度)
  | { type: "usage"; usage: TurnUsage; model?: string } // 本回合 token 用量(agent 上抛,会话经端口落库)
  | { type: "sdk_session"; id: string } // SDK 流出的 session_id(system init 携带)——上抛供会话存库,后续回合 resume 续接 LLM 历史
  | { type: "turn_end" } // GM 本回合自然结束
  | { type: "error"; message: string; code?: string }; // 驱动/SDK 错误(code 可区分:gm_timeout 等;省略→streamTurn 默认 gm_error)

export interface Agent {
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}

// ── Agent 适配缝(spec AD-1) ──
// 任意 agent/harness 经 AgentFactory 适配进架构;CC SDK(DiceGm)是首个适配器。
// AgentInit = 起一个会话 agent 所需的全部:in-process MCP + 系统提示 + skill plugin 引用 + 模型。
//
// skill 加载改「local plugin 按引用 + skills 开关」(裁决 skill-loading-by-reference):
// 不再每回合 cpSync 会话本地副本,而是 boot 期把 skill 母本幂等物化到数据根 pluginRoot(如 $/dice),
// 运行期只把该 pluginRoot 作 SDK plugins:[{type:'local',path}] 按引用加载、skills 开关启用之。
export interface PluginRef {
  pluginDir: string; // 物化后的数据根 pluginRoot 绝对路径(含 .claude-plugin/plugin.json + skills/),如 $/dice
  skills: string[] | "all"; // 启用的 skill 名单('all'=plugin 内全部 skill)
}

export interface AgentInit {
  mcpServer: McpServer; // 会话 in-process MCP(已注入回调/gate)
  openingPrompt: string; // 系统提示(dice=signpost+prologue;lore=构建prompt;教条经 plugin skill 投递,不再内联)
  plugin?: PluginRef; // skill plugin 引用(空=不启 skill,对齐 baseline;非空=按引用加载 + skills 开关)
  workspace?: string; // 素材工作区 cwd(lore build-agent-workspace 用;空=SDK 默认 cwd)
  model?: string; // 默认由 env / 适配器内定
  resume?: string; // SDK 续接:上一回合存下的 sdk_session_id(首回合无值→省略→SDK 开新 session;后续注入→SDK 按此 id 加载该 session 完整 LLM 历史续接)
  sessionId?: string; // GM raw 日志用:标识会话(日志文件名)
  sessionsDir?: string; // GM raw 日志用:sessions 根目录(日志落 <dir>/dicelore/sessions/<id>.gm.log)
  kind?: "dice" | "lore"; // transcript/日志目录归属(sessionDir(sessionsDir, kind, sessionId));缺省 dice
  // ── fake-GM 驱动缝(真 agent 忽略；仅 FAKE_GM 教练档/假构建驱动消费)──
  backend?: SessionBackend; // dice fake 教练档写 canon(roll/choice/gameEnd)所需的会话存储端口(DiceSession.buildInit 注入)
  buildInvoke?: BuildInvoke; // lore fake 假构建驱动写 Draft 的通道(api/lore 组合根注入)
}

export type AgentFactory = (init: AgentInit) => Agent;

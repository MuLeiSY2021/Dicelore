// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/harness 公共面（agent 运行时工具面 + 适配器；显式手写 re-export，不用 auto export*）。
// 这些行原样搬自旧 @dicelore/core barrel 的 mcp/* + adapter/* 部分(storage-port 阶段 5a)。
// 5b 后 backend 组合根(api/server)与 eval 包直接经 @dicelore/harness 消费,不再经 @dicelore/core barrel。
// mcp 工具面只依赖注入的 SessionBackend 端口（@dicelore/interface），不直连 @dicelore/backend——
// 这才是 storage-port ADR 的实际目标：**模块级已无环**。
// 仅 4 个组合根/入口 import @dicelore/backend：dicegm/mcp/main.ts(stdio MCP 入口) +
// adapter/hooks/{session-start,turn-start,turn-end}.ts(CC 契约下独立进程脚本,从 env 自举开库)。
// 这是有意的：composition root 在入口把抽象接到具体实现(Fowler),是入口的本分、不算违例;
// hooks 是 CC spawn 的独立进程,结构上无法收注入。
// 由此 harness↔backend 的**包级**互指(package.json 双向)被**接受为 composition-root 边界**——
// npm workspaces(软链双向)/TS(无 project references)/运行时(无顶层求值环)全都容忍。
// 裁决见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(后果段·包级 harness↔backend 互指接受为 composition-root 边界)。

// 玩家闸控明骰 gate（供 orchestrator / 组件7 注入 gate、触发 commit）。
export { setRollGate, getRollGate, type RollGate } from "./dicegm/mcp/rollGate.js";

// in-process MCP 工厂 + 写后回调接缝（组件7 orchestrator 用）。
export {
  createMcpServer,
  makeToolInvoker,
  wrapToolForTest, // @deprecated 别名,见 server.ts
  type CanonWriteEvent,
  type McpServerDeps,
} from "./dicegm/mcp/server.js";
// 内置工具工厂 + 元数据（组件7 配置页展示真实工具数）。
export { makeTools, BUILTIN_TOOL_NAMES, BUILTIN_TOOL_COUNT } from "./dicegm/mcp/tools.js";
// 工具执行入口（集成/harness 测试经此跑工具）。
export { runTool } from "./dicegm/mcp/runTool.js";
// 工具定义契约（自 @dicelore/interface 转出，供消费方拿类型）。
export type { ToolDef, ToolAnnotations } from "./dicegm/mcp/tooldef.js";

// 回合末 hook（choice 物化 + L3 审计）——组件4，供 orchestrator turn-end 复用。
export { runTurnEnd } from "./dicegm/adapter/turnEnd.js";
// 开场/系统 prompt 组装（组件4，供 orchestrator 装会话上下文）。
export { buildSessionContext } from "./dicegm/adapter/sessionContext.js";
// 项目初始化（写 .mcp.json / settings.json / 装 skills；core cli 的 `init` 子命令经此）。
export { runInit } from "./dicegm/adapter/init.js";

// ===== runtime（会话骨架，组合根/api 注入与驱动用）=====
export type { Session } from "./runtime/session.js";
export { InMemorySessionRegistry } from "./runtime/registry.js";
export type { SessionRegistry } from "./runtime/registry.js";
export type { Agent, AgentInit, AgentFactory, PluginRef, TurnInput, TurnEvent, TurnUsage, BuildInvoke } from "./runtime/agent.js";
export { WsHub, type WsLike } from "./runtime/wsHub.js";
export { streamDriverTurn, type StreamTurnDeps } from "./runtime/streamTurn.js";
export { ensureSkillPlugin } from "./runtime/skillPlugin.js";
export { sessionDir, SessionTranscript, type TranscriptKind } from "./runtime/transcript.js";
export { Rewind, type RollbackHook, type RewindAnchor } from "./runtime/rewind.js";

// ===== dicegm（dice 跑团线，组合根注入 {db,backend} 建会话、api 驱动）=====
export { DiceSession, TurnInProgressError, type DiceSessionDeps } from "./dicegm/DiceSession.js";
export { getOrCreateHost, getHost, removeHost } from "./dicegm/registry.js";
export { DiceGm, parseUsage, type ParsedUsage } from "./dicegm/DiceGm.js";
export { FakeDiceGm, defaultCoachCanon, type CanonAction, type CanonScript } from "./dicegm/FakeDiceGm.js";
export { restagePendingRolls, replayNarration } from "./dicegm/recovery.js";
export { ensureDicePlugin, buildOpeningPrompt, buildBaselinePrompt } from "./dicegm/openingPrompt.js";
export { PlayerRollGate } from "./dicegm/rollGate.js";

// ===== loregm（lore 构建线，组合根建 Draft+构建MCP 注入会话）=====
export { LoreSession, type LoreSessionDeps } from "./loregm/LoreSession.js";
export { FakeLoreGm, defaultBuildScript, type BuildAction, type BuildScript } from "./loregm/FakeLoreGm.js";
export { ensureLorePlugin } from "./loregm/openingPrompt.js";

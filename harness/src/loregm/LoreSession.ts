// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentFactory, PluginRef } from "../runtime/agent.js";
import type { Session, TurnResult } from "../runtime/session.js";

let loreTurnCounter = 0;
function nextTurnId(id: string): string { loreTurnCounter += 1; return `${id}-l${loreTurnCounter}`; }

export interface LoreSessionDeps {
  // 构建 MCP server 由组合根(backend/api/lore)建好注入(BUILD_TOOLS over Draft+Catalog)——
  // loregm 保持 backend-free、不自建 Draft/不 import createBuildMcpServer(storage-port:沿用注入 mcpServer 既有缝)。
  mcpServer: McpServer;
  agentFactory: AgentFactory; // 适配缝;真实现 = CC SDK 适配器挂构建 MCP + 构建 skill
  buildPrompt?: string; // 构建教条(→ openingPrompt;默认 env DICELORE_BUILD_PROMPT)
  plugin?: PluginRef; // 构建 skill plugin 引用(build-pack+build-core,boot 期物化到 $/lore);省略=不启 skill
  workspace?: string; // 素材工作区 cwd(build-agent-workspace 用;本裁决先立入参,接线属该裁决)
}

// lore 构建运行单元:驱动 agent 挂注入的构建 MCP,无 rollGate/turn-end/canon-notify。
// 刻意不持有 gate/db/Draft —— 跑团插件结构上不在场(物理隔离);Draft 由组合根持有(draft 只读端点经组合根读)。
// v1 lore 构建是 REST only:无 WS 端点接入(见 api/lore.ts,只 POST /lore-sessions/:id/messages),
// 故不持 hub/不广播——handleMessage 直接把 driver 跑到 turn_end、轮询/等待返回 {turnId, error?}。
export class LoreSession implements Session {
  readonly kind = "lore" as const;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: LoreSessionDeps) {
    this.mcpServer = deps.mcpServer;
  }

  // 返回 {turnId, error?}:构建 agent 中途 error(LLM 失败/工具异常/FakeDiceGm error 档)不再被吞——
  // 循环捕获 ev.type==="error" 记 { message, code? }、turn_end 时不带 error。error 属领域级,
  // 调用方(api/lore POST messages、build-mcp doSendToBuilder)以 body.error 存在与否判成败(HTTP 保持 200/202)。
  async handleMessage(text: string): Promise<TurnResult> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.agentFactory({
      mcpServer: this.mcpServer,
      openingPrompt: this.deps.buildPrompt ?? process.env.DICELORE_BUILD_PROMPT ?? "",
      plugin: this.deps.plugin,
      workspace: this.deps.workspace,
    });
    // REST 语义:跑完整轮构建反馈(narration/turn_end/error)即收尾,不向任何 WS 广播。
    let error: TurnResult["error"];
    for await (const ev of driver.runTurn({ text, turnId })) {
      if (ev.type === "error") { error = { message: ev.message, code: ev.code }; break; }
      if (ev.type === "turn_end") break;
    }
    return error ? { turnId, error } : { turnId };
  }
}

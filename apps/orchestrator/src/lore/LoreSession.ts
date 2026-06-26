// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createBuildMcpServer, Draft, type CatalogDB } from "@dicelore/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentFactory, SkillRef } from "../pkg/agent.js";
import type { Session } from "../pkg/session.js";

let loreTurnCounter = 0;
function nextTurnId(id: string): string { loreTurnCounter += 1; return `${id}-l${loreTurnCounter}`; }

export interface LoreSessionDeps {
  catalog: CatalogDB;
  name: string; // 在造的团本名(→ UUIDv5 身份)
  agentFactory: AgentFactory; // 适配缝;真实现 = CC SDK 适配器挂构建 MCP + 构建 skill
  buildPrompt?: string; // 构建教条(→ openingPrompt;默认 env DICELORE_BUILD_PROMPT)
  skills?: SkillRef[]; // 构建 skill(会话本地 staged);省略=不 stage
}

// lore 构建运行单元:挂构建 MCP(BUILD_TOOLS over Draft+Catalog),无 rollGate/turn-end/canon-notify。
// 刻意不持有 gate/db —— 跑团插件结构上不在场(物理隔离)。
// v1 lore 构建是 REST only:无 WS 端点接入(见 api/lore.ts,只 POST /lore-sessions/:id/messages),
// 故不持 hub/不广播——handleMessage 直接把 driver 跑到 turn_end、轮询/等待返回 {turnId}。
export class LoreSession implements Session {
  readonly kind = "lore" as const;
  readonly draft = new Draft();
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: LoreSessionDeps) {
    this.mcpServer = createBuildMcpServer({ catalog: deps.catalog, draft: this.draft, name: deps.name });
  }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.agentFactory({
      mcpServer: this.mcpServer,
      openingPrompt: this.deps.buildPrompt ?? process.env.DICELORE_BUILD_PROMPT ?? "",
      skills: this.deps.skills ?? [],
    });
    // REST 语义:跑完整轮构建反馈(narration/turn_end/error)即收尾,不向任何 WS 广播。
    for await (const ev of driver.runTurn({ text, turnId })) {
      if (ev.type === "turn_end" || ev.type === "error") break;
    }
    return { turnId };
  }
}

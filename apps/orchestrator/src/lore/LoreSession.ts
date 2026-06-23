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
import { CLIENT_PROTOCOL } from "@dicelore/shared";
import { WsHub, type WsLike } from "../pkg/wsHub.js";
import { streamDriverTurn } from "../pkg/streamTurn.js";
import type { Agent } from "../pkg/agent.js";
import type { Session } from "../pkg/session.js";

let loreTurnCounter = 0;
function nextTurnId(id: string): string { loreTurnCounter += 1; return `${id}-l${loreTurnCounter}`; }

export interface LoreSessionDeps {
  catalog: CatalogDB;
  name: string; // 在造的团本名(→ UUIDv5 身份)
  driverFactory: (host: LoreSession) => Agent; // 真实现 = LoreBuilder(SDK + 构建 MCP + 构建 skill)
}

// lore 构建运行单元:挂构建 MCP(BUILD_TOOLS over Draft+Catalog),无 rollGate/turn-end/canon-notify。
// 刻意不持有 gate/db —— 跑团插件结构上不在场(物理隔离)。
export class LoreSession implements Session {
  readonly kind = "lore" as const;
  readonly hub = new WsHub();
  readonly draft = new Draft();
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: LoreSessionDeps) {
    this.mcpServer = createBuildMcpServer({ catalog: deps.catalog, draft: this.draft, name: deps.name });
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.driverFactory(this);
    const { seq } = await streamDriverTurn({ driver, hub: this.hub, sessionId: this.sessionId, turnId }, { text });
    // 构建无 turn-end hook / choice / canon-notify —— 直接收尾。
    this.hub.broadcast(this.sessionId, { protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId, seq });
    return { turnId };
  }
}

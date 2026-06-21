// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { openDb, initSchema, createMcpServer, buildPresentationModel, runTurnEnd, type DB, type CanonWriteEvent } from "@dicelore/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WsHub, type WsLike } from "../live/ws.js";
import { PlayerRollGate } from "../live/rollGate.js";
import { mapCanonWrite } from "../live/notify.js";
import { runTurn, type TurnEndResult } from "../live/turnLoop.js";
import type { GmDriver } from "../gm/GmDriver.js";

let turnCounter = 0; // 进程内自增,测试稳定(不依赖随机/时间)
function nextTurnId(sessionId: string): string { turnCounter += 1; return `${sessionId}-t${turnCounter}`; }

export interface SessionHostDeps {
  db?: DB; // 省略则内存库(测试)
  driverFactory: (host: SessionHost) => GmDriver; // 每回合产一个 driver;真实现据 host.mcpServer 建 AgentSdkDriver
}

// 每 session 一个宿主：db + in-process MCP(按实例注入 onCanonWrite/rollGate) + GmDriver + WsHub + turn-end hook。
export class SessionHost {
  readonly db: DB;
  readonly hub = new WsHub();
  readonly gate: PlayerRollGate;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: SessionHostDeps) {
    this.db = deps.db ?? (() => { const d = openDb(":memory:"); initSchema(d); return d; })();
    this.gate = new PlayerRollGate(this.db, this.hub, sessionId);
    this.mcpServer = createMcpServer(this.db, {
      onCanonWrite: (e) => this.onCanonWrite(e),
      rollGate: this.gate.gate,
    });
  }

  onCanonWrite(evt: CanonWriteEvent): void {
    const msg = mapCanonWrite(evt);
    if (msg) this.hub.broadcast(this.sessionId, msg);
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.driverFactory(this);
    await runTurn(
      { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db) },
      { text },
    );
    return { turnId };
  }

  handleRoll(eventId: number): boolean { return this.gate.resolveRoll(eventId); }

  private turnEnd(db: DB): TurnEndResult {
    runTurnEnd(db, { transcriptHasText: true, stopHookActive: false }); // 物化 choice + L3 审计
    const pc = buildPresentationModel(db, { turnStartSeq: 0 }).pendingChoice;
    if (!pc) return {};
    return {
      choices: { eventId: pc.seq, options: pc.options.map((o, index) => ({ index, label: o.label, consequence: o.consequence })) },
    };
  }
}

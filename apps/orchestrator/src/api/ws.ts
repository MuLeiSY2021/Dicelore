// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { DB } from "@dicelore/core";
import { getOrCreateHost } from "../dice/registry.js";
import { restagePendingRolls } from "../dice/recovery.js";
import type { AgentFactory, SkillRef } from "../pkg/agent.js";

export interface WsUpgradeDeps {
  openSession: (id: string) => DB;
  agentFactory: AgentFactory;
  skills?: SkillRef[];
  model?: string;
}

// dice 会话 WS 升级(/sessions/:id/ws)挂到 http server——从原 startServer 内联块抽出,行为不变。
export function attachWsUpgrade(server: unknown, deps: WsUpgradeDeps): void {
  const wss = new WebSocketServer({ noServer: true });
  (server as { on(ev: string, cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void }).on(
    "upgrade",
    (req, socket, head) => {
      const m = /^\/sessions\/([^/]+)\/ws$/.exec(req.url ?? "");
      if (!m) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const id = decodeURIComponent(m[1]);
        const host = getOrCreateHost(id, { db: deps.openSession(id), agentFactory: deps.agentFactory, skills: deps.skills, model: deps.model });
        const wsLike = ws as unknown as { send(d: string): void; readyState: number };
        host.attachWs(wsLike);
        restagePendingRolls(host); // 重连/重启 → 重弹未决掷骰卡
        ws.on("close", () => host.detachWs(wsLike));
      });
    },
  );
}

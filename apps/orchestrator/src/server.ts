// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { openDb, initSchema, type DB } from "@dicelore/core";
import type { SessionInfo, SessionSummary } from "@dicelore/shared";
import { MessageRequestSchema, ChoiceRequestSchema, RollRequestSchema } from "@dicelore/shared";
import { buildSnapshot } from "./presentation.js";
import { listSessionSummaries } from "./sessions.js";
import { getOrCreateHost, getHost } from "./session/registry.js";
import type { SessionHost } from "./session/SessionHost.js";
import type { GmDriver } from "./gm/GmDriver.js";
import { AgentSdkDriver } from "./gm/AgentSdkDriver.js";
import { FakeGmDriver } from "./gm/FakeGmDriver.js";
import { restagePendingRolls } from "./recovery.js";

export interface ServerDeps {
  openSession: (sessionId: string) => DB; // 读侧句柄(每会话一文件；测试可注入内存库)
  listSessions: () => SessionSummary[]; // 会话列表(主页继续上次/最近)
}

export function createApp(deps: ServerDeps): Hono {
  const app = new Hono();

  // 会话列表(主页继续上次 / 最近 Session)
  app.get("/sessions", (c) => c.json({ sessions: deps.listSessions() }));

  // 首屏 / 重连：全量呈现快照(接口页 §2)
  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const db = deps.openSession(id);
    return c.json(buildSnapshot(db, id));
  });

  // 会话元信息(接口页 §2)。v1：终局/标题占位，待写侧接线后回填。
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  return app;
}

// 实时引擎面：动作进(POST messages/choices/roll) + 首屏快照，经 registry/SessionHost。
export interface LiveDeps {
  driverFactory: (host: SessionHost) => GmDriver;
  openSession?: (id: string) => DB; // 省略则 SessionHost 用内存库(测试)
  listSessions?: () => SessionSummary[]; // 会话列表(主页继续上次/最近);省略则空
}

export function createLiveApp(deps: LiveDeps): Hono {
  const app = new Hono();
  const hostDeps = (id: string) => ({ db: deps.openSession?.(id), driverFactory: deps.driverFactory });

  app.get("/sessions", (c) => c.json({ sessions: deps.listSessions?.() ?? [] }));

  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    return c.json(buildSnapshot(host.db, id));
  });
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  app.post("/sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = MessageRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    const { turnId } = await host.handleMessage(body.text);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/choices", async (c) => {
    const id = c.req.param("id");
    const body = ChoiceRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    const { turnId } = await host.handleMessage(`[choice ${body.eventId}#${body.optionIndex}]`);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/roll", async (c) => {
    const id = c.req.param("id");
    const body = RollRequestSchema.parse(await c.req.json());
    const host = getHost(id);
    if (!host || !host.handleRoll(body.eventId)) return c.json({ code: "no_pending_roll" }, 409);
    return c.json({ turnId: id }, 202);
  });

  return app;
}
export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const openSession = (id: string) => { const db = openDb(`${dir}/${id}.db`); initSchema(db); return db; };
  // DICELORE_FAKE_GM=1：用脚本化假 GM(端到端测试,不烧 LLM)；否则真 Agent SDK。
  const driverFactory: (host: SessionHost) => GmDriver = process.env.DICELORE_FAKE_GM === "1"
    ? () => new FakeGmDriver((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (host) => new AgentSdkDriver({ mcpServer: host.mcpServer });

  const app = createLiveApp({ driverFactory, openSession, listSessions: () => listSessionSummaries(dir) });
  const server = serve({ fetch: app.fetch, port });
  const wss = new WebSocketServer({ noServer: true });
  (server as unknown as { on(ev: string, cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void }).on(
    "upgrade",
    (req, socket, head) => {
      const m = /^\/sessions\/([^/]+)\/ws$/.exec(req.url ?? "");
      if (!m) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const host = getOrCreateHost(decodeURIComponent(m[1]), { db: openSession(decodeURIComponent(m[1])), driverFactory });
        const wsLike = ws as unknown as { send(d: string): void; readyState: number };
        host.attachWs(wsLike);
        restagePendingRolls(host); // 重连/重启 → 重弹未决掷骰卡
        ws.on("close", () => host.detachWs(wsLike));
      });
    },
  );
  console.log(`[orchestrator] live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}

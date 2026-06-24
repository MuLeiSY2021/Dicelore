// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { rmSync } from "node:fs";
import { openDb, initSchema, openCatalog } from "@dicelore/core";
import { createLiveApp } from "./api/dice.js";
import { createLoreApp } from "./api/lore.js";
import { createDiagnosticsApp } from "./api/diagnostics.js";
import { attachWsUpgrade } from "./api/ws.js";
import { listSessionSummaries } from "./dice/sessions.js";
import type { DiceSession } from "./dice/DiceSession.js";
import type { LoreSession } from "./lore/LoreSession.js";
import type { Agent } from "./pkg/agent.js";
import { DiceGm } from "./dice/DiceGm.js";
import { FakeDiceGm } from "./dice/FakeDiceGm.js";

export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const openSession = (id: string) => { const db = openDb(`${dir}/${id}.db`); initSchema(db); return db; };
  const catalog = openCatalog(process.env.DICELORE_CATALOG ?? `${dir}/catalog.db`);
  const fake = process.env.DICELORE_FAKE_GM === "1";
  // dice 跑团 driver
  const driverFactory: (host: DiceSession) => Agent = fake
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (host) => new DiceGm({ mcpServer: host.mcpServer, systemPrompt: host.openingPrompt });
  // lore 构建 driver(同 SDK agent,挂构建 MCP;教条由构建 skill 提供,经 systemPrompt)
  const loreDriver: (host: LoreSession) => Agent = fake
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（构建）收到：「${input.text}」` }, { type: "turn_end" }])
    : (host) => new DiceGm({ mcpServer: host.mcpServer, systemPrompt: process.env.DICELORE_BUILD_PROMPT });

  const app = new Hono();
  app.route("/", createLiveApp({
    driverFactory, openSession, catalog,
    listSessions: () => listSessionSummaries(dir),
    deleteSession: (id) => { try { rmSync(`${dir}/${id}.db`); rmSync(`${dir}/${id}.db-wal`, { force: true }); rmSync(`${dir}/${id}.db-shm`, { force: true }); } catch { /* ignore */ } },
  }));
  app.route("/", createLoreApp({ catalog, driverFactory: loreDriver }));
  app.route("/", createDiagnosticsApp({ port, fakeGm: fake }));

  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, driverFactory });
  console.log(`[orchestrator] live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}

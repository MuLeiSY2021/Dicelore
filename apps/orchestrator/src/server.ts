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
import { join } from "node:path";
import { openCatalog, sessionDbPath, openSession as openCoreSession } from "@dicelore/core";
import { createLiveApp } from "./api/dice.js";
import { createLoreApp } from "./api/lore.js";
import { createDiagnosticsApp } from "./api/diagnostics.js";
import { attachWsUpgrade } from "./api/ws.js";
import { listSessionSummaries } from "./dice/sessions.js";
import { gmCoreSkill } from "./dice/openingPrompt.js";
import { buildPackSkill } from "./lore/openingPrompt.js";
import type { AgentFactory, SkillRef } from "./pkg/agent.js";
import { DiceGm } from "./dice/DiceGm.js";
import { FakeDiceGm } from "./dice/FakeDiceGm.js";

export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  // 以 core 路径规则为准(sessionDbPath=${dir}/dicelore/sessions/${id}.db):eval prepareSessionDb 灌种子到同路径,
  // 后端开同库读种子;core openSession 含 mkdir+initSchema+meta,避免种子灌 core 路径而后端开平铺空库。
  const openSession = (id: string) => openCoreSession(id).db;
  const catalog = openCatalog(process.env.DICELORE_CATALOG ?? `${dir}/catalog.db`);
  const fake = process.env.DICELORE_FAKE_GM === "1";
  const baseline = process.env.DICELORE_BASELINE === "1"; // eval baseline:openingPrompt 去 doctrine + skills 空
  // Agent 适配缝:据 AgentInit 产 agent。真=CC SDK 适配器(DiceGm),fake=FakeDiceGm。
  const agentFactory: AgentFactory = fake
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (init) => new DiceGm(init);
  // dice 默认会话本地 skill = gm-core(源目录在则 staged;教条另内联进 openingPrompt 兜底)。
  const gm = gmCoreSkill();
  const diceSkills: SkillRef[] = gm ? [gm] : [];
  // lore 构建 skill = dicelore-build-pack(源目录在则 staged;同 gmCoreSkill() 退化策略)。
  const bp = buildPackSkill();
  const loreSkills: SkillRef[] = bp ? [bp] : [];

  const app = new Hono();
  app.route("/", createLiveApp({
    agentFactory, skills: diceSkills, openSession, catalog, baseline,
    listSessions: () => listSessionSummaries(join(dir, "dicelore", "sessions")),
    deleteSession: (id) => { const p = sessionDbPath(id); try { rmSync(p); rmSync(`${p}-wal`, { force: true }); rmSync(`${p}-shm`, { force: true }); } catch { /* ignore */ } },
  }));
  app.route("/", createLoreApp({ catalog, agentFactory, buildPrompt: process.env.DICELORE_BUILD_PROMPT, skills: loreSkills }));
  app.route("/", createDiagnosticsApp({ port, fakeGm: fake }));

  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, agentFactory, skills: diceSkills, baseline });
  console.log(`[orchestrator] live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}

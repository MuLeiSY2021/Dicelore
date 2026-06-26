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
import { rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { openCatalog, sessionDir, openSession as openCoreSession, initGlobalLogger, getLogger } from "@dicelore/core";
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
  initGlobalLogger(dir); // 全局系统级日志 → $ROOT/{error,info,warn,debug}.log(须在一切 IO 前)
  // 以 core 路径规则为准(sessionDbPath=$ROOT/dice/sessions/${id}/session.db):eval prepareSessionDb 灌种子到同路径,
  // 后端开同库读种子;core openSession 含 mkdir+initSchema+meta,避免种子灌 core 路径而后端开平铺空库。
  const openSession = (id: string) => openCoreSession(id, "dice").db;
  // catalog.db 在 $ROOT/(dice/lore 共用:lore 构建→dice import);openCatalog 不 mkdir,先确保父目录存在。
  const catalogPath = process.env.DICELORE_CATALOG ?? join(dir, "catalog.db");
  mkdirSync(dirname(catalogPath), { recursive: true });
  const catalog = openCatalog(catalogPath);
  const fake = process.env.DICELORE_FAKE_GM === "1";
  const baseline = process.env.DICELORE_BASELINE === "1"; // eval baseline:openingPrompt 去 doctrine + skills 空
  const debug = process.env.DICELORE_DEBUG === "1"; // eval/裸 CC 明骰降级:DICELORE_DEBUG=1 时 DiceSession 不注入 rollGate,core 立即掷(否则 await 永不来的 POST /roll 卡死)
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
    agentFactory, skills: diceSkills, openSession, catalog, baseline, debug, sessionsDir: dir,
    listSessions: () => listSessionSummaries(join(dir, "dice", "sessions")),
    deleteSession: (id) => { try { rmSync(sessionDir(id, "dice"), { recursive: true, force: true }); } catch (e) { getLogger().error({ err: e, id }, "删 session 文件夹失败"); } },
  }));
  app.route("/", createLoreApp({ catalog, agentFactory, buildPrompt: process.env.DICELORE_BUILD_PROMPT, skills: loreSkills }));
  app.route("/", createDiagnosticsApp({ port, fakeGm: fake }));

  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, agentFactory, skills: diceSkills, baseline, debug, sessionsDir: dir });
  // 启动 banner 走 logger(已 initGlobalLogger → 分级文件),不再裸 console.log 重复一行(O2)。
  getLogger().info({ port, fakeGm: fake, debug, sessionsDir: dir, catalog: catalogPath }, `orchestrator live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}

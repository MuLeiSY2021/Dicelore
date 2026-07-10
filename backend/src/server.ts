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
import { rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openCatalog, openSession as openCoreSession, openDb, initSchema } from "@dicelore/backend";
import { initGlobalLogger, getLogger } from "@dicelore/logs";
import { createLiveApp } from "./api/dice.js";
import { createLoreApp } from "./api/lore.js";
import { createDiagnosticsApp } from "./api/diagnostics.js";
import { createUsageApp } from "./api/usage.js";
import { createKeysApp } from "./api/keys.js";
import { createRateLimit } from "./api/rateLimit.js";
import { attachWsUpgrade } from "./api/ws.js";
import { listSessionSummaries } from "./api/sessions.js";
import { resolveDataDir, applyConfigEnv } from "./config.js";
import { ensureDicePlugin, ensureLorePlugin, DiceGm, FakeDiceGm, sessionDir as harnessSessionDir, type AgentFactory, type PluginRef } from "@dicelore/harness";

// 数据根初始化时铺的示例配置(带注释;不落真 config.toml,避免误用示例值)。
// [env] 小节里的 KEY=值 会被 applyConfigEnv 补进 process.env(仅当真实 env 未设);
// 敏感键(DICELORE_KEY_MASTER)一律忽略——只能来自真实进程 env。
// 预留 lower_snake 小节(如 [server])作未来非 env 结构化配置的落点示例(当前不消费)。
const CONFIG_EXAMPLE_TOML = `# Dicelore 配置示例。复制为同目录下 config.toml 生效(本示例文件本身不被读取)。
# 数据根 $ROOT = 本文件所在目录:catalog.db / keys.db / logs/ / sessions/ 均落此。
# 优先级:真实进程 env > config.toml [env]。敏感键(DICELORE_KEY_MASTER)只认真实 env,写这里会被忽略。

[env]
# 监听端口(等价 PORT 环境变量;--port 命令行标志最优先)。
# PORT = "8787"

# 假 GM(不烧 LLM,回固定桩;eval/联调用)。
# DICELORE_FAKE_GM = "0"
# eval baseline:openingPrompt 去 doctrine + skills 全关(分离「教条有无」)。
# DICELORE_BASELINE = "0"
# 明骰降级:DiceSession 不注入 rollGate,core 立即掷(裸 CC / eval)。
# DICELORE_DEBUG = "0"
# GM 模型。
# DICELORE_GM_MODEL = "glm-5.2"
# lore 构建 GM 的 openingPrompt 覆盖。
# DICELORE_BUILD_PROMPT = ""
# per-session 限流(留空=默认 60s/120 次;设 0 关闭)。
# DICELORE_RATELIMIT_WINDOW_MS = "60000"
# DICELORE_RATELIMIT_MAX = "120"

# 预留:未来非 env 的结构化配置落 lower_snake 小节(当前不消费,仅占位示例)。
[server]
# host = "0.0.0.0"
`;

/**
 * 数据根初始化时铺 config.example.toml(带注释、列可识别 env 键 + 预留 lower_snake 小节示例)。
 * 幂等:已存在则不覆盖(保留用户改动);父目录不存在先建。
 */
export function ensureConfigExample(root: string): void {
  mkdirSync(root, { recursive: true });
  const path = join(root, "config.example.toml");
  if (existsSync(path)) return;
  writeFileSync(path, CONFIG_EXAMPLE_TOML);
}

/** 端口解析:--port <n> 标志 > PORT env > 8787。与 server.ts / cli.ts 共用。 */
export function resolvePort(argv: string[], env: Record<string, string | undefined>): number {
  const i = argv.indexOf("--port");
  const flagVal = i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  return Number(flagVal ?? env.PORT ?? 8787);
}

// portOverride 缺省时在 applyConfigEnv(注入 config.toml [env] 的 PORT)之后再解析端口,
// 使 config.toml 写 PORT 能改端口(真实 env 仍优先)。
export function startServer(portOverride?: number): void {
  // 组合根收敛到单一数据根 $ROOT(DD3):--data-dir > DICELORE_DATA_DIR > OS 默认。
  const root = resolveDataDir(process.argv, process.env);
  // 规范化为 DICELORE_DATA_DIR,供 openSession/appDataRoot 与 MCP 子进程(继承 env)派生同一根,单根不分叉。
  process.env.DICELORE_DATA_DIR = root;
  // 读任何 env 配置前先注入 config.toml [env](仅补未设键,真实 env 优先)。
  applyConfigEnv(root);
  // 数据根初始化:铺示例配置(幂等)。
  ensureConfigExample(root);

  const port = portOverride ?? resolvePort(process.argv, process.env);
  initGlobalLogger(join(root, "logs")); // 全局系统级日志 → $ROOT/logs/{error,info,warn,debug}.log(须在一切 IO 前)
  // 子路径全由 $ROOT 派生:
  // 以 core 路径规则为准(session.db=$ROOT/sessions/dice/${id}/session.db):eval prepareSessionDb 灌种子到同路径,
  // 后端开同库读种子;core openSession 含 mkdir+initSchema+meta,避免种子灌 core 路径而后端开平铺空库。
  const openSession = (id: string) => openCoreSession(id, "dice").db;
  // catalog.db 落 $ROOT/(dice/lore 共用:lore 构建→dice import);openCatalog 不 mkdir,父目录已由 ensureConfigExample 建。
  const catalogPath = join(root, "catalog.db");
  const catalog = openCatalog(catalogPath);
  const fake = process.env.DICELORE_FAKE_GM === "1";
  const baseline = process.env.DICELORE_BASELINE === "1"; // eval baseline:openingPrompt 去 doctrine + skills 空
  const debug = process.env.DICELORE_DEBUG === "1"; // eval/裸 CC 明骰降级:DICELORE_DEBUG=1 时 DiceSession 不注入 rollGate,core 立即掷(否则 await 永不来的 POST /roll 卡死)
  // Agent 适配缝:据 AgentInit 产 agent。真=CC SDK 适配器(DiceGm),fake=FakeDiceGm。
  const agentFactory: AgentFactory = fake
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (init) => new DiceGm(init);
  // dice/lore skill plugin:boot 期幂等 + 版本感知物化母本到数据根 $ROOT/{dice,lore}(非每回合复制),
  // 返回运行期 PluginRef(pluginDir + skills:"all");母本定位/物化失败 → ensure*Plugin 内 fail loud 返 null。
  // baseline(DICELORE_BASELINE=1)时 dice plugin 传 undefined(skill 全关,分离「教条有无」);
  // lore 侧无 baseline 概念,始终装 plugin。
  const dicePlugin: PluginRef | undefined = baseline ? undefined : (ensureDicePlugin(root) ?? undefined);
  const lorePlugin: PluginRef | undefined = ensureLorePlugin(root) ?? undefined;

  const app = new Hono();
  // per-session 基础限流(宽松默认 60s/120 次,env DICELORE_RATELIMIT_* 收紧/关闭)——在路由前挂。
  app.use("*", createRateLimit());
  app.route("/", createLiveApp({
    agentFactory, plugin: dicePlugin, openSession, catalog, baseline, debug, sessionsDir: root,
    listSessions: () => listSessionSummaries(join(root, "sessions", "dice"), "dicegm"),
    deleteSession: (id) => { try { rmSync(harnessSessionDir(root, "dice", id), { recursive: true, force: true }); } catch (e) { getLogger().error({ err: e, id }, "删 session 文件夹失败"); } },
  }));
  app.route("/", createLoreApp({
    catalog, agentFactory, buildPrompt: process.env.DICELORE_BUILD_PROMPT, plugin: lorePlugin, sessionsDir: root,
    listSessions: () => listSessionSummaries(join(root, "sessions", "lore"), "loregm"),
  }));
  app.route("/", createDiagnosticsApp({ port, fakeGm: fake }));
  // CO 可视化:GET /sessions/dicegm/:id/usage 只读投影,复用本局 db 端口。
  app.route("/", createUsageApp({ openSession }));
  // SEC2 key 托管:全局 keys.db 落 $ROOT(非 per-session;api_key 表随 initSchema),主密钥经 env 延迟读、缺则端点 503。
  const keysDb = openDb(join(root, "keys.db"));
  initSchema(keysDb);
  app.route("/", createKeysApp({ db: keysDb, master: () => process.env.DICELORE_KEY_MASTER ?? "" }));

  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, agentFactory, plugin: dicePlugin, baseline, debug, sessionsDir: root });
  // 启动 banner 走 logger(已 initGlobalLogger → 分级文件),不再裸 console.log 重复一行(O2)。
  getLogger().info({ port, fakeGm: fake, debug, root, catalog: catalogPath }, `orchestrator live :${port}`);
}

// tsx src/server.ts 直接起:端口在 applyConfigEnv 后于 startServer 内解析(config.toml PORT 生效)。
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer();
}

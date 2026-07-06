// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { metaGet, openSession } from "./index.js";
import { resolveDataDir } from "./config.js";
import { startServer, ensureConfigExample } from "./server.js";
import { runInit } from "@dicelore/harness";
import { getLogger } from "@dicelore/logs";

// --data-dir/--port 与 server.ts 共用解析(resolveDataDir/resolvePort);其余为位置参数。
// 数据根收敛到单一 $ROOT:规范化落 DICELORE_DATA_DIR,openSession/appDataRoot 据此派生同一根。
const root = resolveDataDir(process.argv, process.env);
process.env.DICELORE_DATA_DIR = root;

// 取位置参数:跳过带值标志 --data-dir <v> / --port <v>。
function positionals(argv: string[]): string[] {
  const out: string[] = [];
  const valueFlags = new Set(["--data-dir", "--port"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (valueFlags.has(a)) { i++; continue; } // 连值一起跳
    if (a.startsWith("--")) continue;
    out.push(a);
  }
  return out;
}

const [cmd, arg] = positionals(process.argv.slice(2));

switch (cmd) {
  case "serve": {
    // 数据根初始化 + config.toml [env] 注入在 startServer 内做;端口在注入后解析(config.toml PORT 生效)。
    startServer();
    break;
  }
  case "new": {
    if (!arg) throw new Error("用法: dicelore new <name> [--data-dir <path>]");
    ensureConfigExample(root);
    const s = openSession(arg);
    console.log(`已建/打开会话 ${s.name} → ${s.path}`);
    break;
  }
  case "list": {
    // DD2 布局:session 是 $ROOT/sessions/dice/<name>/ 自包含文件夹,枚举子目录名。
    const dir = join(root, "sessions", "dice");
    let names: string[] = [];
    try { names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); }
    catch (e) { getLogger().warn({ err: e, dir }, "readdir 会话目录失败(目录不存在),预期降级"); }
    console.log(names.length ? names.map((n) => "  " + n).join("\n") : "(无会话)");
    break;
  }
  case "inspect": {
    if (!arg) throw new Error("用法: dicelore inspect <name>");
    const { db } = openSession(arg);
    const stateCnt = (db.prepare("SELECT COUNT(*) c FROM state").get() as { c: number }).c;
    const events = (db.prepare("SELECT COUNT(*) c FROM log").get() as { c: number }).c;
    console.log(`会话 ${arg}: 团本=${metaGet(db, "team_id") ?? "(未灌注)"} stateCnt=${stateCnt} events=${events}`);
    break;
  }
  case "init": {
    const session = arg ?? "default";
    ensureConfigExample(root);
    runInit({ projectDir: process.cwd(), session });
    console.log(`已在 ${process.cwd()} 写入 .claude/(MCP + 三 hook + skills),会话=${session}`);
    break;
  }
  default:
    console.log("命令: serve [--data-dir <path>] [--port <n>] | new <name> | list | inspect <name> | init [session]");
}

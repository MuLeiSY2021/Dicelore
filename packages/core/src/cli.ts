// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { metaGet, openSession, sessionDbPath } from "./session/resolve.js";
import { runInit } from "./adapter/init.js";

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case "new": {
    if (!arg) throw new Error("用法: dicelore new <name>");
    const s = openSession(arg);
    console.log(`已建/打开会话 ${s.name} → ${s.path}`);
    break;
  }
  case "list": {
    const dir = dirname(sessionDbPath("_"));
    let files: string[] = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith(".db")); } catch { /* 目录不存在 */ }
    console.log(files.length ? files.map((f) => "  " + f.replace(/\.db$/, "")).join("\n") : "(无会话)");
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
    runInit({ projectDir: process.cwd(), session });
    console.log(`已在 ${process.cwd()} 写入 .claude/(MCP + 三 hook + skills),会话=${session}`);
    break;
  }
  default:
    console.log("命令: new <name> | list | inspect <name> | init [session]");
}

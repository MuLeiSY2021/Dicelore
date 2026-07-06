// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { sessionDir as harnessSessionDir } from "@dicelore/harness";
import { initSchema, openDb, type DB } from "../store/db.js";
import { resolveDataDir } from "../config.js";

const SCHEMA_VERSION = "1";

// 数据根单源(DD3):组合根 server.ts 已 resolveDataDir → 落 DICELORE_DATA_DIR,openSession/DiceGm 据此
// 派生同一 $ROOT/sessions/<kind>/<id>,不再有第二套根。这里只需与之一致——一律复用 resolveDataDir(config.ts)。
// 遗留 DICELORE_SESSIONS_DIR 仅在「无任何显式数据根」时兜底(eval/scenario、旧脚本、resolve 单测),
// 一旦出现显式 --data-dir / DICELORE_DATA_DIR 即以其为准(压过遗留 env),保证单根收敛。
function appDataRoot(): string {
  const explicit = process.env.DICELORE_DATA_DIR !== undefined || process.argv.includes("--data-dir");
  if (!explicit && process.env.DICELORE_SESSIONS_DIR) return process.env.DICELORE_SESSIONS_DIR;
  return resolveDataDir(process.argv, process.env);
}

// session 自包含文件夹布局(DD2:sessions 顶层、kind 次级、id 叶级):
//   <root>/sessions/dice/<name>/{session.db, <name>_session.jsonl, error.log, info.log, ...}
//   <root>/sessions/lore/<name>/{...}(lore 无 db,用内存 Draft;路径预留)
// 每 session 一个自包含文件夹,打包/迁移/删除以文件夹为单位;sessionDir 即该文件夹,openSession 据此 mkdir。
// 物理路径单源走 harness 的 backend-free 纯函数 sessionDir(dataDir, kind, id)——backend 只补 dataDir=appDataRoot(),
// 保证与 DiceGm/SessionTranscript 落点完全一致。
export type SessionKind = "dice" | "lore";
export function sessionDir(name: string, kind: SessionKind = "dice"): string {
  return harnessSessionDir(appDataRoot(), kind, name);
}
export function sessionDbPath(name: string, kind: SessionKind = "dice"): string {
  return join(sessionDir(name, kind), "session.db");
}

export function metaGet(db: DB, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM session_meta WHERE key=?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function metaSet(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO session_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, value);
}

export function openSession(name?: string, kind: SessionKind = "dice"): { db: DB; name: string; path: string } {
  const sessionName = name ?? process.env.DICELORE_SESSION ?? "default";
  const path = sessionDbPath(sessionName, kind);
  mkdirSync(dirname(path), { recursive: true });
  const db = openDb(path);
  initSchema(db);
  if (!metaGet(db, "created_at")) metaSet(db, "created_at", new Date().toISOString());
  metaSet(db, "display_name", sessionName);
  metaSet(db, "schema_version", SCHEMA_VERSION);
  return { db, name: sessionName, path };
}

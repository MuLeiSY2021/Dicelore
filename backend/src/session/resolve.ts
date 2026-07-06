// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { sessionDir as harnessSessionDir } from "@dicelore/harness";
import { initSchema, openDb, type DB } from "../store/db.js";

const SCHEMA_VERSION = "1";

function appDataRoot(): string {
  if (process.env.DICELORE_SESSIONS_DIR) return process.env.DICELORE_SESSIONS_DIR;
  const home = homedir();
  switch (platform()) {
    case "win32": return process.env.APPDATA ?? join(home, "AppData", "Roaming");
    case "darwin": return join(home, "Library", "Application Support");
    default: return process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
  }
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

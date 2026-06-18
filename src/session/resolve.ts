import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { initSchema, openDb, type DB } from "../store/db.js";

const SCHEMA_VERSION = "1";

function appDataRoot(): string {
  if (process.env.ANKO_SESSIONS_DIR) return process.env.ANKO_SESSIONS_DIR;
  const home = homedir();
  switch (platform()) {
    case "win32": return process.env.APPDATA ?? join(home, "AppData", "Roaming");
    case "darwin": return join(home, "Library", "Application Support");
    default: return process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
  }
}

export function sessionDbPath(name: string): string {
  return join(appDataRoot(), "anko_driver", "sessions", `${name}.db`);
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

export function openSession(name?: string): { db: DB; name: string; path: string } {
  const sessionName = name ?? process.env.ANKO_SESSION ?? "default";
  const path = sessionDbPath(sessionName);
  mkdirSync(dirname(path), { recursive: true });
  const db = openDb(path);
  initSchema(db);
  if (!metaGet(db, "created_at")) metaSet(db, "created_at", new Date().toISOString());
  metaSet(db, "display_name", sessionName);
  metaSet(db, "schema_version", SCHEMA_VERSION);
  return { db, name: sessionName, path };
}

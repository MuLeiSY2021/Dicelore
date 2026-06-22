// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import Database from "better-sqlite3";
import { FTS_TABLES, ftsTableDDL } from "./fts.js";

export type DB = Database.Database;

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// 幂等建表。log 在本 plan 是普通表(全文检索归 Plan 2)。
export function initSchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      entity TEXT NOT NULL,
      attr TEXT NOT NULL,
      value TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'world',
      rel_object TEXT,
      rel_dim TEXT,
      clock_min INTEGER,
      clock_max INTEGER,
      clock_mode TEXT,
      PRIMARY KEY (entity, attr)
    );
    CREATE TABLE IF NOT EXISTS log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT, kind TEXT NOT NULL, data_json TEXT, tags TEXT,
      visible INTEGER NOT NULL DEFAULT 1, game_time TEXT,
      is_moment INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS watcher (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_seq INTEGER, condition TEXT NOT NULL, payload TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'once', armed INTEGER NOT NULL DEFAULT 1,
      last_fired_seq INTEGER, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS world_doc (
      name TEXT, content TEXT, category TEXT, tags TEXT, visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS world_pool (
      pool TEXT, row_json TEXT, weight REAL NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'author',
      visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rule_doc (
      name TEXT, content TEXT, category TEXT, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS session_meta ( key TEXT PRIMARY KEY, value TEXT );
    CREATE TABLE IF NOT EXISTS pending_choice (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      seq_staged INTEGER, prompt TEXT, options_json TEXT, status TEXT
    );
    CREATE TABLE IF NOT EXISTS pending_roll (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      shape TEXT NOT NULL,          -- 'outcome' | 'contest'
      spec_json TEXT NOT NULL,      -- 规格(无结果)
      status TEXT NOT NULL DEFAULT 'awaiting',  -- 'awaiting' | 'committed'
      verdict_seq INTEGER           -- commit 后链接 kind=verdict event 的 seq
    );
  `);

  // ===== FTS5 全文检索虚表(Plan 2)=====
  // 与并行「回合快照线」的 snapshot 表互不重叠;改动只在此集中,便于对方 rebase。
  for (const t of FTS_TABLES) db.exec(ftsTableDDL(t));
}

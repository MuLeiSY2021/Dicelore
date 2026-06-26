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
import { initViews } from "./views.js";

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
      last_fired_seq INTEGER, status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS lore (
      name TEXT, content TEXT, category TEXT, tags TEXT, visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pool (
      pool TEXT, row_json TEXT, weight REAL NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'author',
      visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rule (
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
    CREATE TABLE IF NOT EXISTS front (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, stakes TEXT,
      clock_ref TEXT, status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS plotline (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT,
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS foreshadow (
      id TEXT PRIMARY KEY, content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planted'
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seq_from INTEGER NOT NULL, seq_to INTEGER NOT NULL,
      summary TEXT NOT NULL, created_seq INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS anchor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_table TEXT NOT NULL, owner_id TEXT NOT NULL,
      target_table TEXT NOT NULL, target_id TEXT NOT NULL,
      role TEXT
    );
    -- ===== 回合快照(SNAP-1 / ADR-0017 v1 降预期：只自动持久化，存档/读档) =====
    -- 每回合边界 checkpoint() 落一行：blob_json 为「participant 名 → 整表 dump」的全量快照。
    -- turn_start_seq / turn_end_seq 记快照覆盖的 log seq 区间(start 暂未用、留 v2 branch 锚点)。
    -- parent_id 链前一快照(快照线性链；v2 branch/swipe 在此之上长出树，v1 不分叉)。
    -- 全量行/回合(非增量 diff)——解耦子系统、restore = 整表覆写不逆级联(ADR-0017「细化落地」)。
    CREATE TABLE IF NOT EXISTS snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      turn_start_seq INTEGER,
      turn_end_seq INTEGER,
      blob_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- ===== token 用量计量(CO-采集 / store/usage.ts)=====
    -- 带外计量明细表：每条 = 一次 Agent SDK result 回传的 usage 采样。
    -- 归因双采：turn_id(per-turn) + agent(per-agent) + session_id，按需聚合不预聚合。
    -- 与 snapshot 表互相独立(不进快照/回滚/FTS)——各自 CREATE，不冲突。
    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ===== FTS5 全文检索虚表(Plan 2)=====
  // 与并行「回合快照线」的 snapshot 表互不重叠;改动只在此集中,便于对方 rebase。
  for (const t of FTS_TABLES) db.exec(ftsTableDDL(t));

  // ===== 命名视图投影(叙事层 spec §4)=====
  // 表全建好后投影;视图层是下游 toolgen 读工具的稳定逻辑列契约。
  initViews(db);
}

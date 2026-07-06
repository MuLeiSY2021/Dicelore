// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { initSchema, openDb } from "./db.js";

describe("schema", () => {
  test("初始化建出四域表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["state", "log", "watcher", "lore", "pool", "rule", "session_meta", "pending_choice", "front", "plotline", "foreshadow", "history", "anchor"]) {
      expect(names).toContain(t);
    }
  });
  test("幂等:重复 initSchema 不报错", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(() => initSchema(db)).not.toThrow();
  });

  test("初始化建出 FTS 虚表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["log_fts", "lore_fts", "rule_fts"]) {
      expect(names).toContain(t);
    }
  });

  test("TR3:snapshot 表含 transcript_anchor 列", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const cols = (db.prepare("PRAGMA table_info(snapshot)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("transcript_anchor");
  });

  test("TR3 迁移:既有(无 transcript_anchor 列的)snapshot 表被 initSchema 幂等补列", () => {
    const db = openDb(":memory:");
    // 模拟迁移前建的旧库:手建不含 transcript_anchor 的 snapshot 表 + 一行旧数据。
    db.exec(`CREATE TABLE snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER,
      turn_start_seq INTEGER, turn_end_seq INTEGER, blob_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.prepare("INSERT INTO snapshot (blob_json) VALUES ('{}')").run();
    initSchema(db); // 迁移应补列且不丢旧行
    const cols = (db.prepare("PRAGMA table_info(snapshot)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("transcript_anchor");
    const old = db.prepare("SELECT transcript_anchor a FROM snapshot WHERE id=1").get() as { a: string | null };
    expect(old.a).toBeNull(); // 旧行该列为 NULL
  });
});

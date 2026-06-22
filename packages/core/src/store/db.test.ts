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
    for (const t of ["state", "event", "watcher", "world_doc", "world_pool", "rule_doc", "session_meta", "pending_choice"]) {
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
    for (const t of ["event_fts", "world_doc_fts", "rule_doc_fts"]) {
      expect(names).toContain(t);
    }
  });
});

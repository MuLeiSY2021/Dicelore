// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import { ftsIndex, ftsSearch } from "./fts.js";

export interface RuleDoc {
  rowid: number;
  name: string;
  content: string;
  category: string | null;
  version: number;
}

// 作者灌注 / 版本化热更新(§4.4)。AI 不可写 → 本文件不暴露 register/ai 接口。
export function ruleUpsert(db: DB, r: { name: string; content: string; category?: string }): number {
  const existing = db.prepare("SELECT rowid, version FROM rule_doc WHERE name=?").get(r.name) as
    | { rowid: number; version: number }
    | undefined;
  let rowid: number;
  if (existing) {
    rowid = existing.rowid;
    db.prepare("UPDATE rule_doc SET content=?, category=?, version=? WHERE rowid=?").run(
      r.content, r.category ?? null, existing.version + 1, rowid,
    );
  } else {
    const info = db
      .prepare("INSERT INTO rule_doc (name, content, category, version) VALUES (?, ?, ?, 1)")
      .run(r.name, r.content, r.category ?? null);
    rowid = Number(info.lastInsertRowid);
  }
  ftsIndex(db, "rule_doc_fts", rowid, `${r.name}\n${r.content}`);
  return rowid;
}

export function ruleGet(db: DB, name: string): RuleDoc | undefined {
  return db
    .prepare("SELECT rowid, name, content, category, version FROM rule_doc WHERE name=?")
    .get(name) as RuleDoc | undefined;
}

export function ruleSearch(db: DB, query: string, limit = 20): RuleDoc[] {
  const hits = ftsSearch(db, "rule_doc_fts", query, limit);
  const stmt = db.prepare("SELECT rowid, name, content, category, version FROM rule_doc WHERE rowid=?");
  return hits.map((h) => stmt.get(h.rowid) as RuleDoc | undefined).filter((r): r is RuleDoc => r !== undefined);
}

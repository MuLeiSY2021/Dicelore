// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import { FTS_TABLES, ftsDelete, ftsIndex, ftsSearch, ftsTableDDL } from "./fts.js";

let db: Database.Database;
beforeEach(() => { db = new Database(":memory:"); for (const t of FTS_TABLES) db.exec(ftsTableDDL(t, "jieba")); });
afterEach(() => { delete process.env.DICELORE_FTS_MODE; });

describe("ftsIndex + ftsSearch (jieba)", () => {
  test("index 后按 2 字词召回(命中 raw)", () => {
    ftsIndex(db, "lore_fts", 1, "青云门派收弟子");
    ftsIndex(db, "lore_fts", 2, "魔教长老议事");
    const hits = ftsSearch(db, "lore_fts", "门派");
    expect(hits).toEqual([{ rowid: 1, raw: "青云门派收弟子" }]);
  });
  test("多词 OR 召回多行", () => {
    ftsIndex(db, "lore_fts", 1, "青云门派收弟子");
    ftsIndex(db, "lore_fts", 2, "魔教长老议事");
    expect(ftsSearch(db, "lore_fts", "门派 长老").map((h) => h.rowid).sort()).toEqual([1, 2]);
  });
  test("reindex 同 rowid 不重复", () => {
    ftsIndex(db, "lore_fts", 1, "旧文本");
    ftsIndex(db, "lore_fts", 1, "青云门派");
    expect(ftsSearch(db, "lore_fts", "门派")).toEqual([{ rowid: 1, raw: "青云门派" }]);
    expect(ftsSearch(db, "lore_fts", "旧文本")).toEqual([]);
  });
  test("ftsDelete 移除", () => {
    ftsIndex(db, "lore_fts", 1, "青云门派");
    ftsDelete(db, "lore_fts", 1);
    expect(ftsSearch(db, "lore_fts", "门派")).toEqual([]);
  });
});

describe("trigram 保底", () => {
  test("≥3 字 MATCH、<3 字 LIKE 兜底", () => {
    const t = new Database(":memory:");
    t.exec(ftsTableDDL("lore_fts", "trigram"));
    ftsIndex(t, "lore_fts", 1, "青云门派收弟子");
    process.env.DICELORE_FTS_MODE = "trigram";
    expect(ftsSearch(t, "lore_fts", "门派收").map((h) => h.rowid)).toEqual([1]); // MATCH
    expect(ftsSearch(t, "lore_fts", "门派").map((h) => h.rowid)).toEqual([1]); // LIKE 兜底
  });
  test("trigram 表搜索不依赖 DICELORE_FTS_MODE env(非对称消除)", () => {
    // env 保持默认 jieba,但表是 trigram — ftsSearch 应从表 DDL 读 mode
    const t = new Database(":memory:");
    t.exec(ftsTableDDL("lore_fts", "trigram"));
    ftsIndex(t, "lore_fts", 1, "青云门派收弟子");
    // 不设置 DICELORE_FTS_MODE,env 保持 jieba 默认
    expect(process.env.DICELORE_FTS_MODE).toBeUndefined();
    expect(ftsSearch(t, "lore_fts", "门派收").map((h) => h.rowid)).toEqual([1]); // trigram MATCH
    expect(ftsSearch(t, "lore_fts", "门派").map((h) => h.rowid)).toEqual([1]); // <3 字 → LIKE 兜底
  });
});

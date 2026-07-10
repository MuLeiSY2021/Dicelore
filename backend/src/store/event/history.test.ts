// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../db.js";
import { historyAppend, historyCompact, historyList } from "./history.js";
import { logAppend } from "./record.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

test("append 返回自增 id", () => {
  const id1 = historyAppend(db, { seq_from: 1, seq_to: 5, summary: "第一幕结束", created_seq: 5 });
  const id2 = historyAppend(db, { seq_from: 6, seq_to: 10, summary: "第二幕结束", created_seq: 10 });
  expect(id1).toBe(1);
  expect(id2).toBe(2);
});

test("historyList 按 id 顺序返回全部", () => {
  historyAppend(db, { seq_from: 1, seq_to: 5, summary: "幕一", created_seq: 5 });
  historyAppend(db, { seq_from: 6, seq_to: 10, summary: "幕二", created_seq: 10 });
  const list = historyList(db);
  expect(list).toHaveLength(2);
  expect(list[0]).toMatchObject({ id: 1, seq_from: 1, seq_to: 5, summary: "幕一", created_seq: 5 });
  expect(list[1]).toMatchObject({ id: 2, seq_from: 6, seq_to: 10, summary: "幕二", created_seq: 10 });
});

test("historyCompact 写一条摘要，created_seq = 当前最大 log seq", () => {
  logAppend(db, { content: "一", kind: "narrate" });
  logAppend(db, { content: "二", kind: "narrate" });
  const lastSeq = logAppend(db, { content: "三", kind: "narrate" });
  const id = historyCompact(db, { seq_from: 1, seq_to: 2, summary: "第一幕:伏笔X已埋" });
  expect(id).toBe(1);
  const list = historyList(db);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ seq_from: 1, seq_to: 2, summary: "第一幕:伏笔X已埋", created_seq: lastSeq });
});

test("historyCompact 空 log 库时 created_seq 回落到 seq_to", () => {
  const id = historyCompact(db, { seq_from: 1, seq_to: 5, summary: "空压缩" });
  expect(id).toBe(1);
  expect(historyList(db)[0]).toMatchObject({ created_seq: 5 });
});

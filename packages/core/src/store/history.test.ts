// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { historyAppend, historyList } from "./history.js";

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

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
import { logAppend } from "./record.js";
import { markMoment } from "./moment.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

test("markMoment 把指定 log 行 is_moment 置 1，返回受影响行数", () => {
  const seq = logAppend(db, { content: "关键抉择", kind: "narrate" });
  logAppend(db, { content: "闲聊", kind: "narrate" });
  const changed = markMoment(db, seq);
  expect(changed).toBe(1);
  const row = db.prepare("SELECT is_moment FROM log WHERE seq=?").get(seq) as { is_moment: number };
  expect(row.is_moment).toBe(1);
});

test("markMoment 只标目标行，不影响其他行", () => {
  const s1 = logAppend(db, { content: "一", kind: "narrate" });
  const s2 = logAppend(db, { content: "二", kind: "narrate" });
  markMoment(db, s2);
  expect((db.prepare("SELECT is_moment FROM log WHERE seq=?").get(s1) as { is_moment: number }).is_moment).toBe(0);
  expect((db.prepare("SELECT is_moment FROM log WHERE seq=?").get(s2) as { is_moment: number }).is_moment).toBe(1);
});

test("markMoment 不存在的 seq → 返回 0（幂等无副作用）", () => {
  expect(markMoment(db, 999)).toBe(0);
});

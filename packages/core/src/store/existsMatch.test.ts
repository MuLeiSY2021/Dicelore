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
import { plotlineUpsert } from "./plotline.js";
import { logAppend } from "./log.js";
import { makeExistsMatch } from "./existsMatch.js";

let db: DB, ex: ReturnType<typeof makeExistsMatch>;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); ex = makeExistsMatch(db); });

test("state 行存在性匹配(列 + 数值比较)", () => {
  // stateSet 不接收 kind，直接 INSERT 造数据
  db.prepare("INSERT INTO state(entity,attr,value,kind) VALUES(?,?,?,'npc')").run("老大", "敌意", "9");
  expect(ex("state", [{ col: "attr", op: "=", val: "敌意" }, { col: "value", op: ">=", val: "8" }])).toBe(true);
  expect(ex("state", [{ col: "attr", op: "=", val: "敌意" }, { col: "value", op: ">=", val: "20" }])).toBe(false);
});

test("plotline status 匹配", () => {
  plotlineUpsert(db, { id: "荒漠", title: "荒漠诅咒", status: "open" });
  expect(ex("plotline", [{ col: "id", op: "=", val: "荒漠" }, { col: "status", op: "=", val: "open" }])).toBe(true);
});

test("log 匹配 + sinceSeq 只认更新事件", () => {
  const s1 = logAppend(db, { kind: "choice", content: "驰援" });
  expect(ex("log", [{ col: "kind", op: "=", val: "choice" }])).toBe(true);
  expect(ex("log", [{ col: "kind", op: "=", val: "choice" }], s1)).toBe(false); // seq>s1 无
});

test("未知 ns / 未知列 抛 BAD_INPUT", () => {
  expect(() => ex("evil", [{ col: "x", op: "=", val: "1" }])).toThrow();
  expect(() => ex("state", [{ col: "drop", op: "=", val: "1" }])).toThrow();
});

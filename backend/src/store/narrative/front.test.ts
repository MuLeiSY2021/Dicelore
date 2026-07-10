// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../db.js";
import { frontUpsert, frontGet, frontList, frontSetStatus, frontOmenList } from "./front.js";
import { watcherSet } from "./watcher.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("front store", () => {
  test("upsert 后 get（默认 status=active，visible=0）", () => {
    frontUpsert(db, { id: "魔道入侵", name: "魔道入侵", stakes: "护山大阵能否建成", clock_ref: "世界.入侵进度" });
    expect(frontGet(db, "魔道入侵")).toMatchObject({
      id: "魔道入侵", name: "魔道入侵", stakes: "护山大阵能否建成", clock_ref: "世界.入侵进度", status: "active", visible: 0,
    });
  });
  test("setStatus 改 spent；list 返回全部", () => {
    frontUpsert(db, { id: "f1", name: "线1" });
    frontSetStatus(db, "f1", "spent");
    expect(frontGet(db, "f1")!.status).toBe("spent");
    expect(frontList(db).map((f) => f.id)).toEqual(["f1"]);
  });
});

test("frontOmenList 只返回该 front 的凶兆 watcher", () => {
  frontUpsert(db, { id: "魔道入侵", name: "魔道入侵" });
  watcherSet(db, { condition: "{世界.入侵进度} >= 3", payload: "边境沦陷", source: "front:魔道入侵" });
  watcherSet(db, { condition: "{张三.HP} < 5", payload: "无关", source: "manual" });
  const omens = frontOmenList(db, "魔道入侵");
  expect(omens.map((w) => w.payload)).toEqual(["边境沦陷"]);
});

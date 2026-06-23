// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../store/db.js";
import { stateSet, stateGet } from "../store/state.js";
import { defineView } from "./view.js";
import { compileTool } from "./compile.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

describe("compileTool 首词分发", () => {
  test("SELECT decl → 读工具(回行)", () => {
    stateSet(db, "张三", "HP", "20");
    const t = compileTool({ name: "hp_of", params: { who: "string" }, sql: "SELECT value FROM state WHERE attr='HP' AND entity=:who" });
    expect(t.handler(db, { who: "张三" })).toEqual([{ value: "20" }]);
  });

  test("UPDATE decl → 写工具(经正典原语,落 state)", () => {
    stateSet(db, "张三", "金币", "100");
    const t = compileTool({ name: "spend", params: { buyer: "string", price: "int" }, sql: "UPDATE player SET 金币 = 金币 - :price WHERE entity = :buyer" });
    t.handler(db, { buyer: "张三", price: 30 });
    expect(stateGet(db, "张三", "金币")!.value).toBe("70");
  });

  test("defineView + 视图上的读工具 端到端", () => {
    stateSet(db, "铁剑", "价", "50");
    defineView(db, "shop_inv", "SELECT entity AS name, value AS price FROM state WHERE attr='价'");
    const t = compileTool({ name: "shop_q", params: { n: "string" }, sql: "SELECT price FROM shop_inv WHERE name=:n" });
    expect(t.handler(db, { n: "铁剑" })).toEqual([{ price: "50" }]);
  });
});

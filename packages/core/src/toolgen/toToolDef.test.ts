// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "../store/db.js";
import { stateSet } from "../store/state.js";
import { toolgenToToolDef } from "./toToolDef.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

describe("toolgenToToolDef", () => {
  test("读声明 → ToolDef：inputSchema 由 params 生成、readOnlyHint=true、handler 出参包 result", () => {
    stateSet(db, "勇者", "HP", "20");
    const def = toolgenToToolDef({
      name: "hp_query",
      desc: "查 HP",
      params: { who: "string" },
      sql: "SELECT value FROM state WHERE entity = :who AND attr = 'HP'",
    });
    expect(def.name).toBe("hp_query");
    expect(def.description).toBe("查 HP");
    expect(def.annotations.readOnlyHint).toBe(true);
    // inputSchema 接受 {who:"勇者"}，拒缺参
    expect(() => def.inputSchema.parse({ who: "勇者" })).not.toThrow();
    expect(() => def.inputSchema.parse({})).toThrow();
    // handler 出参包 {result: 行数组}
    const out = def.handler(db, { who: "勇者" });
    expect(out).toEqual({ result: [{ value: "20" }] });
    // outputSchema 接受 {result:...}
    expect(() => def.outputSchema.parse(out)).not.toThrow();
  });

  test("写声明 → ToolDef：readOnlyHint=false", () => {
    const def = toolgenToToolDef({
      name: "plot_close",
      desc: "收一条线",
      params: { id: "string", s: "string" },
      sql: "UPDATE plotline SET status = :s WHERE id = :id",
    });
    expect(def.annotations.readOnlyHint).toBe(false);
    expect(def.name).toBe("plot_close");
  });

  test("int 参数类型映射为 z.number().int()", () => {
    const def = toolgenToToolDef({
      name: "by_floor",
      params: { floor: "int" },
      sql: "SELECT entity FROM state WHERE attr = :floor",
    });
    expect(() => def.inputSchema.parse({ floor: 3 })).not.toThrow();
    expect(() => def.inputSchema.parse({ floor: "x" })).toThrow();
  });
});

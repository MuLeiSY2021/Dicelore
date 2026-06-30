// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { stateSet } from "../store/sheet/state.js";
import { compileReadTool } from "./readTool.js";

describe("compileReadTool", () => {
  test("读工具:绑定 :param 跑 SELECT 回行", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "张三", "HP", "20");
    stateSet(db, "李四", "HP", "30");
    const t = compileReadTool({
      name: "hp_of",
      params: { who: "string" },
      sql: "SELECT value FROM state WHERE attr='HP' AND entity=:who",
    });
    expect(t.handler(db, { who: "张三" })).toEqual([{ value: "20" }]);
  });

  test("读工具:无参数也能跑", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "张三", "HP", "20");
    const t = compileReadTool({
      name: "all_hp",
      sql: "SELECT entity, value FROM state WHERE attr='HP'",
    });
    expect(t.handler(db, {})).toEqual([{ entity: "张三", value: "20" }]);
  });

  test("读工具:非只读 sql 抛 BAD_INPUT", () => {
    expect(() =>
      compileReadTool({
        name: "bad",
        sql: "UPDATE state SET value='x' WHERE entity=:e",
      })
    ).toThrow();
  });

  test("读工具:缺少声明参数抛错", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const t = compileReadTool({
      name: "hp_of",
      params: { who: "string" },
      sql: "SELECT value FROM state WHERE attr='HP' AND entity=:who",
    });
    expect(() => t.handler(db, {})).toThrow();
  });

  test("读工具:SQL 用了未声明的 :param 编译期抛 BAD_INPUT", () => {
    expect(() =>
      compileReadTool({
        name: "hp_of",
        // SQL 引用 :who 但 params 未声明 who
        sql: "SELECT value FROM state WHERE attr='HP' AND entity=:who",
      })
    ).toThrow();
    // 部分声明、部分漏声明也应在编译期暴露
    expect(() =>
      compileReadTool({
        name: "pair",
        params: { a: "string" },
        sql: "SELECT 1 WHERE x=:a AND y=:b",
      })
    ).toThrow();
  });

  test("读工具有 name 和 desc", () => {
    const t = compileReadTool({
      name: "test_tool",
      desc: "测试工具",
      sql: "SELECT 1",
    });
    expect(t.name).toBe("test_tool");
    expect(t.desc).toBe("测试工具");
  });
});

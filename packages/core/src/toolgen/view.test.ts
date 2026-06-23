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
import { stateSet } from "../store/state.js";
import { defineView } from "./view.js";

describe("defineView", () => {
  test("定义视图后可查", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "张三", "HP", "20");
    defineView(db, "hp_view", "SELECT entity, value FROM state WHERE attr='HP'");
    expect(
      db.prepare("SELECT value FROM hp_view WHERE entity='张三'").get()
    ).toMatchObject({ value: "20" });
  });

  test("拒非法名 / 写 sql", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(() => defineView(db, "x; DROP", "SELECT 1")).toThrow();
    expect(() => defineView(db, "v", "DELETE FROM state")).toThrow();
  });

  test("拒名字含非 \\w 字符", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(() => defineView(db, "my-view", "SELECT 1")).toThrow();
    expect(() => defineView(db, "my view", "SELECT 1")).toThrow();
  });

  test("视图可引用另一视图", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "张三", "HP", "20");
    defineView(db, "hp_view", "SELECT entity, value FROM state WHERE attr='HP'");
    defineView(db, "hp_view2", "SELECT entity, value FROM hp_view");
    expect(
      db.prepare("SELECT value FROM hp_view2 WHERE entity='张三'").get()
    ).toMatchObject({ value: "20" });
  });
});

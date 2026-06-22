// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { stateSet } from "../store/state.js";
import { resolveContest } from "./contest.js";
import { DiceloreError } from "../errors.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

describe("resolveContest", () => {
  it("取 sheet 真值比大小 → winner a", () => {
    const db = freshDb();
    stateSet(db, "张三", "力量", "15");
    const r = resolveContest(db, { name: "张三", expr: "{张三.力量}" }, { name: "DC", expr: "10" });
    expect(r.a.ledger.total).toBe(15);
    expect(r.b.ledger.total).toBe(10);
    expect(r.winner).toBe("a");
  });

  it("相等 → tie", () => {
    const db = freshDb();
    const r = resolveContest(db, { name: "A", expr: "10" }, { name: "B", expr: "10" });
    expect(r.winner).toBe("tie");
  });

  it("引用不存在 → 透传 ENTITY_NOT_FOUND", () => {
    const db = freshDb();
    try { resolveContest(db, { name: "A", expr: "{无.无}" }, { name: "B", expr: "1" }); } catch (e) {
      expect((e as DiceloreError).code).toBe("ENTITY_NOT_FOUND");
    }
  });
});

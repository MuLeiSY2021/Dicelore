import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { sheetSetRaw } from "../store/sheet.js";
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
    sheetSetRaw(db, "张三", "力量", "15");
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

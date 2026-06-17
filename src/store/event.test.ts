import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { eventAppend, eventSince } from "./event.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("event store", () => {
  test("append 返回单调 seq", () => {
    const s1 = eventAppend(db, { kind: "narrate", content: "天黑了" });
    const s2 = eventAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(s2).toBe(s1 + 1);
  });
  test("visible 默认按 kind(note=0、narrate=1)", () => {
    eventAppend(db, { kind: "note", content: "GM 私记" });
    eventAppend(db, { kind: "narrate", content: "可见" });
    const rows = eventSince(db, 0);
    expect(rows.find((r) => r.kind === "note")!.visible).toBe(0);
    expect(rows.find((r) => r.kind === "narrate")!.visible).toBe(1);
  });
  test("data_json 往返", () => {
    eventAppend(db, { kind: "mutation", data_json: { applied: [{ attr: "HP", delta: -5 }] } });
    const row = eventSince(db, 0)[0];
    expect(JSON.parse(row.data_json!)).toEqual({ applied: [{ attr: "HP", delta: -5 }] });
  });
  test("eventSince 只取区间后", () => {
    eventAppend(db, { kind: "narrate", content: "a" });
    const mark = eventAppend(db, { kind: "narrate", content: "b" });
    eventAppend(db, { kind: "narrate", content: "c" });
    expect(eventSince(db, mark).map((r) => r.content)).toEqual(["c"]);
  });
});

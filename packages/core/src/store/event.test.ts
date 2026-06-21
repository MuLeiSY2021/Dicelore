// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { eventAppend, eventRecall, eventSince } from "./event.js";

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

describe("eventRecall (FTS + tag 兜底)", () => {
  test("按内容 2 字词召回", () => {
    eventAppend(db, { kind: "narrate", content: "青云门派今日收徒" });
    eventAppend(db, { kind: "narrate", content: "城外风平浪静" });
    const hits = eventRecall(db, "门派");
    expect(hits.map((r) => r.content)).toEqual(["青云门派今日收徒"]);
  });
  test("content 为空的 event 不进 FTS、不报错", () => {
    eventAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(eventRecall(db, "门派")).toEqual([]);
  });
  test("tag LIKE 兜底(内容未命中、tag 命中)", () => {
    eventAppend(db, { kind: "narrate", content: "昨夜无事", tags: "剧情线,伏笔" });
    const hits = eventRecall(db, "剧情线");
    expect(hits.map((r) => r.content)).toEqual(["昨夜无事"]);
  });
});

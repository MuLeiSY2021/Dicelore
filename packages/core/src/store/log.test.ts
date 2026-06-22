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
import { logAppend, logRecall, logSince } from "./log.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("event store", () => {
  test("append 返回单调 seq", () => {
    const s1 = logAppend(db, { kind: "narrate", content: "天黑了" });
    const s2 = logAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(s2).toBe(s1 + 1);
  });
  test("visible 默认按 kind(note=0、narrate=1)", () => {
    logAppend(db, { kind: "note", content: "GM 私记" });
    logAppend(db, { kind: "narrate", content: "可见" });
    const rows = logSince(db, 0);
    expect(rows.find((r) => r.kind === "note")!.visible).toBe(0);
    expect(rows.find((r) => r.kind === "narrate")!.visible).toBe(1);
  });
  test("data_json 往返", () => {
    logAppend(db, { kind: "mutation", data_json: { applied: [{ attr: "HP", delta: -5 }] } });
    const row = logSince(db, 0)[0];
    expect(JSON.parse(row.data_json!)).toEqual({ applied: [{ attr: "HP", delta: -5 }] });
  });
  test("logSince 只取区间后", () => {
    logAppend(db, { kind: "narrate", content: "a" });
    const mark = logAppend(db, { kind: "narrate", content: "b" });
    logAppend(db, { kind: "narrate", content: "c" });
    expect(logSince(db, mark).map((r) => r.content)).toEqual(["c"]);
  });
});

describe("logRecall (FTS + tag 兜底)", () => {
  test("按内容 2 字词召回", () => {
    logAppend(db, { kind: "narrate", content: "青云门派今日收徒" });
    logAppend(db, { kind: "narrate", content: "城外风平浪静" });
    const hits = logRecall(db, "门派");
    expect(hits.map((r) => r.content)).toEqual(["青云门派今日收徒"]);
  });
  test("content 为空的 event 不进 FTS、不报错", () => {
    logAppend(db, { kind: "verdict", data_json: { winner: "a" } });
    expect(logRecall(db, "门派")).toEqual([]);
  });
  test("tag LIKE 兜底(内容未命中、tag 命中)", () => {
    logAppend(db, { kind: "narrate", content: "昨夜无事", tags: "剧情线,伏笔" });
    const hits = logRecall(db, "剧情线");
    expect(hits.map((r) => r.content)).toEqual(["昨夜无事"]);
  });
});

test("is_moment 默认 0、可设 1", () => {
  const s0 = logAppend(db, { kind: "narrate", content: "平淡" });
  const s1 = logAppend(db, { kind: "narrate", content: "关键转折", is_moment: 1 });
  const rows = logSince(db, 0);
  expect(rows.find((r) => r.seq === s0)!.is_moment).toBe(0);
  expect(rows.find((r) => r.seq === s1)!.is_moment).toBe(1);
});

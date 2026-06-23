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
import { recomputeWatchers, watcherList, watcherSet } from "./watcher.js";
import { logAppend, logSince } from "./log.js";
import { makeEvalCtx } from "./evalCtx.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

const ctxWith = (hp: number) => ({ getRef: (_e: string, _a: string) => String(hp) });

test("watcherSet 默认 source='manual'、可设 source", () => {
  const id1 = watcherSet(db, { condition: "{张三.HP} < 10", payload: "濒死" });
  const id2 = watcherSet(db, { condition: "{张三.HP} < 5", payload: "凶兆", source: "front:魔道入侵" });
  const list = watcherList(db);
  expect(list.find((w) => w.id === id1)!.source).toBe("manual");
  expect(list.find((w) => w.id === id2)!.source).toBe("front:魔道入侵");
});

describe("watcher", () => {
  test("条件满足 → 触发一次、落 watcher_fired、armed→0", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "濒死!" });
    const fired = recomputeWatchers(db, ctxWith(20));
    expect(fired).toEqual([{ id: 1, payload: "濒死!" }]);
    expect(logSince(db, 0).some((r) => r.kind === "watcher_fired")).toBe(true);
    // 再次重算(仍满足)不重复触发(edge)
    expect(recomputeWatchers(db, ctxWith(20))).toEqual([]);
  });
  test("once 触发后 status→fired,不再出现在 active 列表", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "x", mode: "once" });
    recomputeWatchers(db, ctxWith(20));
    expect(watcherList(db)).toHaveLength(0);
  });
  test("repeat 条件解除后 re-arm,可再次触发", () => {
    watcherSet(db, { condition: "{张三.HP} < 30", payload: "low", mode: "repeat" });
    expect(recomputeWatchers(db, ctxWith(20))).toHaveLength(1); // 触发
    expect(recomputeWatchers(db, ctxWith(50))).toHaveLength(0); // 解除 → re-arm
    expect(recomputeWatchers(db, ctxWith(20))).toHaveLength(1); // 再触发
  });
});

describe("watcher log-has + since 游标", () => {
  test("log-has watcher: once 出现即触发一次", () => {
    watcherSet(db, { condition: "{log:has(kind=choice)}", payload: "选了", mode: "once" });
    logAppend(db, { kind: "choice", content: "驰援" });
    const fired = recomputeWatchers(db, makeEvalCtx(db));
    expect(fired.map((f) => f.payload)).toEqual(["选了"]);
    // 再 recompute 不重复(once 已 disarm)
    expect(recomputeWatchers(db, makeEvalCtx(db))).toEqual([]);
  });

  test("repeat log-has: since 游标只认新事件、可重触发", () => {
    watcherSet(db, { condition: "{log:has(kind=reveal)}", payload: "揭示", mode: "repeat" });
    logAppend(db, { kind: "reveal", content: "A" });
    expect(recomputeWatchers(db, makeEvalCtx(db)).length).toBe(1); // 触发1
    expect(recomputeWatchers(db, makeEvalCtx(db)).length).toBe(0); // 无新 reveal,re-arm 不触发
    logAppend(db, { kind: "reveal", content: "B" });
    expect(recomputeWatchers(db, makeEvalCtx(db)).length).toBe(1); // 新 reveal,再触发
  });
});

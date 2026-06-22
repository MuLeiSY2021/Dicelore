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
import { logSince } from "./log.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

const ctxWith = (hp: number) => ({ getRef: (_e: string, _a: string) => String(hp) });

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

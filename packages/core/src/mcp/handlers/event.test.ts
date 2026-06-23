// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/event.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { logSince } from "../../store/log.js";
import { watcherList, watcherSet } from "../../store/watcher.js";
import { eventTools } from "./event.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => eventTools.find((t) => t.name === n)!;

describe("event handlers", () => {
  it("event_append:落 event 回 event_id;tags 数组合并写入", () => {
    const db = freshDb();
    const out = byName("event_append").handler(db, {
      content: "夜里下起暴雨", kind: "note", tags: ["天气", "夜"],
    });
    expect(typeof out.event_id).toBe("number");
    expect(logSince(db, 0)).toHaveLength(1);
  });

  it("event_recall:FTS 召回独有词", () => {
    const db = freshDb();
    byName("event_append").handler(db, { content: "苍鹭栖息在钟楼尖顶", kind: "note" });
    byName("event_append").handler(db, { content: "无关的另一条记录", kind: "note" });
    const out = byName("event_recall").handler(db, { query: "苍鹭", k: 8 });
    expect(out.events.length).toBeGreaterThanOrEqual(1);
    expect(out.events.some((e: any) => e.content.includes("苍鹭"))).toBe(true);
    expect(out.truncated).toBe(false);
  });

  it("watcher_set:登记 active watcher 回 watcher_id", () => {
    const db = freshDb();
    const out = byName("watcher_set").handler(db, {
      condition: "{张三.HP} < 10", payload: "濒死!", mode: "once",
    });
    expect(typeof out.watcher_id).toBe("number");
    expect(watcherList(db)).toHaveLength(1);
  });

  it("watcher_list:列出所有 active(armed) watcher,供 GM 回顾未触发的钟/Front", () => {
    const db = freshDb();
    byName("watcher_set").handler(db, { condition: "{世界.入侵} >= 6", payload: "破阵", mode: "once" });
    byName("watcher_set").handler(db, { condition: "{张三.HP} < 10", payload: "濒死", mode: "repeat" });
    const out = byName("watcher_list").handler(db, {});
    expect(out.watchers).toHaveLength(2);
    const w = out.watchers.find((x: any) => x.condition === "{世界.入侵} >= 6");
    expect(w).toMatchObject({ payload: "破阵", mode: "once", armed: 1, status: "active" });
    expect(typeof w.id).toBe("number");
  });

  it("event_append 触发 log-has watcher,回 fired_watchers", () => {
    const db = freshDb();
    watcherSet(db, { condition: "{log:has(kind=reveal)}", payload: "有新揭示", mode: "once" });
    const out = byName("event_append").handler(db, { kind: "reveal", content: "秘密曝光" });
    expect(out.fired_watchers).toBeDefined();
    expect(out.fired_watchers.length).toBe(1);
    expect(out.fired_watchers[0].payload).toBe("有新揭示");
  });
});

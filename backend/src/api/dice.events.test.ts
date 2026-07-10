// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// spoiler-tiering 裁决 §一.2 FE9-4：GET /events 全量下发含 visible=0（废弃 visibleOnly 默认过滤 → 默认全量）。
// 后端不做 visible 截流：暗骰结果/隐藏 sheet 改等 visible=0 事件默认回填，前端按 spoiler 档本地渲染。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";

function memSessions(): { open: (id: string) => DB; dbs: Map<string, DB> } {
  const dbs = new Map<string, DB>();
  const open = (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
  return { open, dbs };
}

function seedLog(db: DB, kind: string, content: string, visible: number): void {
  db.prepare("INSERT INTO log (content, kind, visible) VALUES (?,?,?)").run(content, kind, visible);
}

describe("GET /sessions/dicegm/:id/events 全量下发（FE9-4）", () => {
  it("默认回填含 visible=0 事件（暗骰结果等），且带 visible 字段", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("sess1");
    seedLog(db, "narrate", "你推开门", 1);   // seq 1 可见
    seedLog(db, "verdict", "暗骰命中", 0);    // seq 2 暗骰结果 visible=0

    const res = await app.request("/sessions/dicegm/sess1/events");
    expect(res.status).toBe(200);
    const { events } = (await res.json()) as { events: { seq: number; kind: string; text: string; visible?: number }[] };
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.seq)).toEqual([1, 2]);
    // visible 字段随事件下发（前端据此按 spoiler 档渲染）
    expect(events.find((e) => e.seq === 1)?.visible).toBe(1);
    expect(events.find((e) => e.seq === 2)?.visible).toBe(0);
    removeHost("sess1");
  });

  it("显式 visibleOnly=true 仍只回可见事件（保留参数、翻转默认）", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("sess2");
    seedLog(db, "narrate", "明叙", 1);
    seedLog(db, "verdict", "暗骰", 0);

    const res = await app.request("/sessions/dicegm/sess2/events?visibleOnly=true");
    const { events } = (await res.json()) as { events: { seq: number }[] };
    expect(events).toHaveLength(1);
    expect(events[0].seq).toBe(1);
    removeHost("sess2");
  });

  it("since 分段仍生效，且默认含 visible=0", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("sess3");
    seedLog(db, "narrate", "第一段", 1);   // seq 1
    seedLog(db, "note", "隐记", 0);          // seq 2 visible=0
    seedLog(db, "narrate", "第三段", 1);   // seq 3

    const res = await app.request("/sessions/dicegm/sess3/events?since=1");
    const { events } = (await res.json()) as { events: { seq: number }[] };
    expect(events.map((e) => e.seq)).toEqual([2, 3]);
    removeHost("sess3");
  });
});

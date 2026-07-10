// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// spoiler-tiering 裁决 §一.5 FE9-5：bay 按需拉 visible=0 端点 + 分页。
// GET /sessions/dicegm/:id/presentation?includeHidden=true&offset&limit
//   默认（无 includeHidden）：只投影 visible=1（bay sheet group btn 默认拉）。
//   includeHidden=true：全量含 visible=0（仅 spoiler=关闭 且点 btn 时前端调），offset/limit 分页防卡。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";

function memSessions(): { open: (id: string) => DB } {
  const dbs = new Map<string, DB>();
  const open = (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
  return { open };
}
function seedCell(db: DB, entity: string, attr: string, value: string, visible: number): void {
  db.prepare("INSERT INTO state (entity, attr, value, visible) VALUES (?,?,?,?)").run(entity, attr, value, visible);
}

describe("GET /presentation?includeHidden 按需拉 visible=0 + 分页（FE9-5）", () => {
  it("默认只回 visible=1", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("p1");
    seedCell(db, "张三", "HP", "12", 1);
    seedCell(db, "张三", "暗好感", "99", 0);
    const snap = (await (await app.request("/sessions/dicegm/p1/presentation")).json()) as {
      sheets: { entity: string; cells: { attr: string; visible: number }[] }[];
    };
    const attrs = snap.sheets.flatMap((g) => g.cells.map((c) => c.attr));
    expect(attrs).toEqual(["HP"]);
    removeHost("p1");
  });

  it("includeHidden=true 回全量含 visible=0，cell 带真实 visible", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("p2");
    seedCell(db, "张三", "HP", "12", 1);
    seedCell(db, "张三", "暗好感", "99", 0);
    const snap = (await (await app.request("/sessions/dicegm/p2/presentation?includeHidden=true")).json()) as {
      sheets: { entity: string; cells: { attr: string; visible: number }[] }[];
    };
    const g = snap.sheets.find((x) => x.entity === "张三");
    expect(g?.cells).toEqual([
      { attr: "HP", value: "12", visible: 1 },
      { attr: "暗好感", value: "99", visible: 0 },
    ]);
    removeHost("p2");
  });

  it("offset/limit 分页", async () => {
    const { open } = memSessions();
    const app = createLiveApp({ openSession: open, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const db = open("p3");
    seedCell(db, "e1", "a", "1", 0);
    seedCell(db, "e1", "b", "2", 0);
    seedCell(db, "e2", "c", "3", 0);
    const snap = (await (await app.request("/sessions/dicegm/p3/presentation?includeHidden=true&offset=1&limit=1")).json()) as {
      sheets: { entity: string; cells: { attr: string }[] }[];
    };
    const flat = snap.sheets.flatMap((g) => g.cells.map((c) => ({ entity: g.entity, attr: c.attr })));
    expect(flat).toEqual([{ entity: "e1", attr: "b" }]);
    removeHost("p3");
  });
});

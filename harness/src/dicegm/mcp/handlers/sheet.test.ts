// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/sheet.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { stateGet, stateSet } from "@dicelore/backend";
import { logSince } from "@dicelore/backend";
import { makeSheetTools } from "./sheet.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
// 内置工具 handler 经注入 SessionBackend 调存储——按 db 造工具、handler 忽略传入的 db 形参。
const byName = (db: any, n: string) => makeSheetTools(openSessionBackend(db)).find((t) => t.name === n)!;

describe("sheet handlers（A′ §4：仅剩即兴兜底写 sheet_update）", () => {
  it("裸 sheet_get / sheet_list 已删（类型化读替代）", () => {
    const db = freshDb();
    const names = makeSheetTools(openSessionBackend(db)).map((t) => t.name);
    expect(names).toEqual(["sheet_update"]);
    expect(names).not.toContain("sheet_get");
    expect(names).not.toContain("sheet_list");
  });

  it("sheet_update:落 mutation event 透传 event_id + applied 账本", () => {
    const db = freshDb();
    stateSet(db, "张三", "HP", "30");
    const out = byName(db, "sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "HP", op: "-", expr: "5" }],
    });
    expect(out.entity).toBe("张三");
    expect(out.applied[0].new).toBe("25");
    expect(typeof out.event_id).toBe("number");
    expect(stateGet(db, "张三", "HP")?.value).toBe("25");
    expect(logSince(db, 0).filter((e) => e.kind === "mutation")).toHaveLength(1);
  });

  it("sheet_update:即兴写新 attr 默认落 kind=world（C4 兜底口径）", () => {
    const db = freshDb();
    // 全新实体/属性，无 kind 标注 → applyMutations 默认 kind=world
    byName(db, "sheet_update").handler(db, {
      entity: "村口古井",
      mutations: [{ attr: "水位", op: "=", expr: "3" }],
    });
    const worldRows = db.prepare("SELECT entity, attr, value FROM world WHERE entity='村口古井'").all() as any[];
    expect(worldRows).toContainEqual(expect.objectContaining({ entity: "村口古井", attr: "水位", value: "3" }));
  });

  it("sheet_update:非数值算术抛 NOT_NUMERIC(整批回滚由内层保证)", () => {
    const db = freshDb();
    stateSet(db, "张三", "名", "李四");
    expect(() => byName(db, "sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "名", op: "+", expr: "1" }],
    })).toThrow(/非数值/);
  });
});

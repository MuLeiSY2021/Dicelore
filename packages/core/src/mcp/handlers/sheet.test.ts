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
import { openDb, initSchema } from "../../store/db.js";
import { sheetSetRaw, sheetGet } from "../../store/sheet.js";
import { eventSince } from "../../store/event.js";
import { sheetTools } from "./sheet.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => sheetTools.find((t) => t.name === n)!;

describe("sheet handlers", () => {
  it("sheet_get:命中返回 value+visible;缺失返回 {value:null,visible:0}", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30", 1);
    expect(byName("sheet_get").handler(db, { entity: "张三", attr: "HP" })).toEqual({ value: "30", visible: 1 });
    expect(byName("sheet_get").handler(db, { entity: "张三", attr: "无" })).toEqual({ value: null, visible: 0 });
  });

  it("sheet_list:前缀扫 + 分页字段", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "库存:剑", "1");
    sheetSetRaw(db, "张三", "库存:盾", "1");
    sheetSetRaw(db, "张三", "库存:药", "3");
    const out = byName("sheet_list").handler(db, { entity: "张三", prefix: "库存:", limit: 2, offset: 0 });
    expect(out.cells).toHaveLength(2);
    expect(out.has_more).toBe(true);
    expect(out.next_offset).toBe(2);
    expect(out.truncated).toBe(false);
  });

  it("sheet_update:落 mutation event 透传 event_id + applied 账本", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30");
    const out = byName("sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "HP", op: "-", expr: "5" }],
    });
    expect(out.entity).toBe("张三");
    expect(out.applied[0].new).toBe("25");
    expect(typeof out.event_id).toBe("number");
    expect(sheetGet(db, "张三", "HP")?.value).toBe("25");
    expect(eventSince(db, 0).filter((e) => e.kind === "mutation")).toHaveLength(1);
  });

  it("sheet_update:非数值算术抛 NOT_NUMERIC(整批回滚由内层保证)", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "名", "李四");
    expect(() => byName("sheet_update").handler(db, {
      entity: "张三",
      mutations: [{ attr: "名", op: "+", expr: "1" }],
    })).toThrow(/非数值/);
  });
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, it, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventSince } from "./event.js";
import { worldDocUpsert, worldPoolAdd } from "./world.js";
import { revealOnce, sheetShow, worldShow } from "./visibility.js";
import { DiceloreError } from "../errors.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("sheetShow", () => {
  test("attr 级置 visible=1 + 审计 note(对玩家隐)", () => {
    sheetSetRaw(db, "张三", "HP", "30", 0);
    sheetShow(db, "张三", "HP");
    expect(sheetGet(db, "张三", "HP")!.visible).toBe(1);
    const note = eventSince(db, 0).find((e) => e.kind === "note");
    expect(note!.visible).toBe(0);
  });
  test("暗值 visible=2 焊死,attr 级 show 不揭", () => {
    sheetSetRaw(db, "张三", "底牌", "杀招", 2);
    sheetShow(db, "张三", "底牌");
    expect(sheetGet(db, "张三", "底牌")!.visible).toBe(2);
  });
  test("entity 级写 __show_all 策略 cell", () => {
    sheetShow(db, "张三");
    expect(sheetGet(db, "张三", "__show_all")!.value).toBe("1");
  });
});

describe("worldShow", () => {
  test("置 world_doc.visible=1 + 审计", () => {
    const rowid = worldDocUpsert(db, { name: "青云门", content: "正道大派" });
    worldShow(db, "world_doc", rowid);
    expect(db.prepare("SELECT visible FROM world_doc WHERE rowid=?").get(rowid)).toMatchObject({ visible: 1 });
    expect(eventSince(db, 0).some((e) => e.kind === "note" && e.visible === 0)).toBe(true);
  });

  test("置 world_pool.visible=1 + 审计", () => {
    const rowid = worldPoolAdd(db, { pool: "npc", row: { name: "老李", job: "铁匠" } });
    worldShow(db, "world_pool", rowid);
    expect(db.prepare("SELECT visible FROM world_pool WHERE rowid=?").get(rowid)).toMatchObject({ visible: 1 });
    expect(eventSince(db, 0).some((e) => e.kind === "note" && e.visible === 0)).toBe(true);
  });
});

describe("revealOnce", () => {
  test("sheet:append kind=reveal 可见 event 存冻结值,不碰目标 visible", () => {
    sheetSetRaw(db, "张三", "真名", "赵四", 0);
    const seq = revealOnce(db, { kind: "sheet", entity: "张三", attr: "真名" });
    const ev = eventSince(db, 0).find((e) => e.seq === seq)!;
    expect(ev.kind).toBe("reveal");
    expect(ev.visible).toBe(1);
    expect(JSON.parse(ev.data_json!)).toMatchObject({ kind: "sheet", entity: "张三", attr: "真名", value: "赵四" });
    // 目标底层仍隐
    expect(sheetGet(db, "张三", "真名")!.visible).toBe(0);
  });
});

it("revealOnce sheet cell 不存在抛 ENTITY_NOT_FOUND", () => {
  const localDb = openDb(":memory:");
  initSchema(localDb);
  try {
    revealOnce(localDb, { kind: "sheet", entity: "不存在实体", attr: "HP" });
  } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("ENTITY_NOT_FOUND");
  }
});
it("revealOnce world_doc 不存在抛 ENTITY_NOT_FOUND", () => {
  const localDb = openDb(":memory:");
  initSchema(localDb);
  try {
    revealOnce(localDb, { kind: "world_doc", rowid: 9999 });
  } catch (e) {
    expect((e as DiceloreError).code).toBe("ENTITY_NOT_FOUND");
  }
});

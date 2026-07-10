// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "./db.js";
import { frontUpsert } from "./narrative/front.js";
import { plotlineUpsert } from "./narrative/plotline.js";
import { foreshadowUpsert } from "./narrative/foreshadow.js";
import { watcherSet } from "./narrative/watcher.js";

// 造 kind 数据的测试辅助：stateSet 不接 kind 参数，直接 INSERT 造 player/npc/world 行。
function seedState(
  db: DB,
  row: {
    entity: string;
    attr: string;
    value: string;
    visible?: number;
    kind: "player" | "npc" | "world";
    rel_object?: string | null;
    rel_dim?: string | null;
    clock_min?: number | null;
    clock_max?: number | null;
    clock_mode?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO state (entity, attr, value, visible, kind, rel_object, rel_dim, clock_min, clock_max, clock_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.entity,
    row.attr,
    row.value,
    row.visible ?? 0,
    row.kind,
    row.rel_object ?? null,
    row.rel_dim ?? null,
    row.clock_min ?? null,
    row.clock_max ?? null,
    row.clock_mode ?? null,
  );
}

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db); // initSchema 末尾调 initViews，视图自动建好
});

describe("state 派生命名视图", () => {
  test("initSchema 自动建出全部视图（无需显式调 initViews）", () => {
    const views = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view'")
      .all()
      .map((r: any) => r.name);
    for (const v of ["player", "npc", "world", "relation", "clock", "tension_board", "plotline_visible", "foreshadow_visible", "lore_visible"]) {
      expect(views).toContain(v);
    }
  });

  test("player 视图只含 kind=player 行、投影 4 列", () => {
    seedState(db, { entity: "勇者", attr: "HP", value: "20", visible: 1, kind: "player" });
    seedState(db, { entity: "村长", attr: "好感", value: "5", kind: "npc" });
    const rows = db.prepare("SELECT entity, attr, value, visible FROM player").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity: "勇者", attr: "HP", value: "20", visible: 1 });
  });

  test("npc 视图只含 kind=npc 行", () => {
    seedState(db, { entity: "勇者", attr: "HP", value: "20", kind: "player" });
    seedState(db, { entity: "村长", attr: "好感", value: "5", kind: "npc" });
    seedState(db, { entity: "黄枫谷", attr: "势力", value: "大", kind: "world" });
    const rows = db.prepare("SELECT entity FROM npc").all() as any[];
    expect(rows.map((r) => r.entity)).toEqual(["村长"]);
  });

  test("world 视图只含 kind=world 行", () => {
    seedState(db, { entity: "黄枫谷", attr: "势力", value: "大", kind: "world" });
    seedState(db, { entity: "村长", attr: "好感", value: "5", kind: "npc" });
    const rows = db.prepare("SELECT entity FROM world").all() as any[];
    expect(rows.map((r) => r.entity)).toEqual(["黄枫谷"]);
  });

  test("relation 视图只含 rel_object 非空行、投影关系列", () => {
    seedState(db, { entity: "勇者", attr: "关系", value: "敌意", kind: "player", rel_object: "魔王", rel_dim: "敌意" });
    seedState(db, { entity: "勇者", attr: "HP", value: "20", kind: "player" });
    const rows = db.prepare("SELECT entity, rel_object, rel_dim, value, visible FROM relation").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity: "勇者", rel_object: "魔王", rel_dim: "敌意", value: "敌意" });
  });

  test("clock 视图只含 clock_min/clock_max 非空行、投影 clock 列", () => {
    seedState(db, { entity: "城门", attr: "攻城进度", value: "2", kind: "world", clock_min: 0, clock_max: 6, clock_mode: "steps" });
    seedState(db, { entity: "勇者", attr: "HP", value: "20", kind: "player" });
    const rows = db.prepare("SELECT entity, attr, value, clock_min, clock_max, clock_mode FROM clock").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity: "城门", clock_min: 0, clock_max: 6, clock_mode: "steps" });
  });

  test("同一实体可出现在多个视图（非互斥投影）", () => {
    seedState(db, { entity: "黄枫谷", attr: "势力", value: "大", kind: "npc" });
    seedState(db, { entity: "黄枫谷", attr: "位置", value: "东山", kind: "world" });
    expect((db.prepare("SELECT entity FROM npc").all() as any[]).map((r) => r.entity)).toContain("黄枫谷");
    expect((db.prepare("SELECT entity FROM world").all() as any[]).map((r) => r.entity)).toContain("黄枫谷");
  });
});

describe("tension_board 聚合视图", () => {
  test("列未结张力：active front + open/active plotline + planted foreshadow + armed watcher", () => {
    // active front（进）+ resolved front（不进）
    frontUpsert(db, { id: "f1", name: "城门攻防", status: "active" });
    frontUpsert(db, { id: "f2", name: "旧怨", status: "resolved" });
    // open + active plotline（进）+ closed（不进）
    plotlineUpsert(db, { id: "p1", title: "主线", status: "open" });
    plotlineUpsert(db, { id: "p2", title: "支线", status: "active" });
    plotlineUpsert(db, { id: "p3", title: "已收", status: "closed" });
    // planted foreshadow（进）+ recalled（不进）
    foreshadowUpsert(db, { id: "fs1", content: "神秘信物", status: "planted" });
    foreshadowUpsert(db, { id: "fs2", content: "已回收", status: "recalled" });
    // armed watcher（进）+ disarmed watcher（不进，watcherSet 恒建 armed=1，再 UPDATE 解除）
    watcherSet(db, { condition: "HP<=0", payload: "死亡" });
    const disarmedId = watcherSet(db, { condition: "GP>=100", payload: "富" });
    db.prepare("UPDATE watcher SET armed=0 WHERE id=?").run(disarmedId);

    const rows = db
      .prepare("SELECT kind, id, label, status FROM tension_board ORDER BY kind, id")
      .all() as { kind: string; id: string; label: string; status: string }[];

    expect(rows).toEqual([
      { kind: "foreshadow", id: "fs1", label: "神秘信物", status: "planted" },
      { kind: "front", id: "f1", label: "城门攻防", status: "active" },
      { kind: "plotline", id: "p1", label: "主线", status: "open" },
      { kind: "plotline", id: "p2", label: "支线", status: "active" },
      { kind: "watcher", id: expect.any(String), label: "HP<=0", status: "active" },
    ]);
  });

  test("空库 tension_board 视图查不报错、返回空", () => {
    const rows = db.prepare("SELECT * FROM tension_board").all();
    expect(rows).toEqual([]);
  });
});

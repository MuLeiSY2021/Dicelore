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
import {
  loreGet, loreSearch, loreUpsert,
  poolAdd, worldRegister, poolSample,
} from "./world.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

describe("lore", () => {
  test("upsert 后 get", () => {
    loreUpsert(db, { name: "青云门", content: "正道大派,坐落青云山", category: "门派" });
    expect(loreGet(db, "青云门")).toMatchObject({ name: "青云门", content: "正道大派,坐落青云山", category: "门派", visible: 0 });
  });
  test("同名 upsert 覆盖内容(不新增行)", () => {
    loreUpsert(db, { name: "青云门", content: "旧设定" });
    loreUpsert(db, { name: "青云门", content: "新设定" });
    expect(loreGet(db, "青云门")!.content).toBe("新设定");
    expect(db.prepare("SELECT COUNT(*) c FROM lore").get()).toMatchObject({ c: 1 });
  });
  test("FTS 搜索命中(含按 name 召回)", () => {
    loreUpsert(db, { name: "青云门", content: "正道大派" });
    loreUpsert(db, { name: "魔教", content: "邪道势力" });
    expect(loreSearch(db, "正道").map((d) => d.name)).toEqual(["青云门"]);
    expect(loreSearch(db, "魔教").map((d) => d.name)).toEqual(["魔教"]);
  });
  test("FTS 覆盖 tags(§5 tag 兜底召回)", () => {
    loreUpsert(db, { name: "青云门", content: "正道大派", tags: "仙侠,门派" });
    expect(loreSearch(db, "仙侠").map((d) => d.name)).toEqual(["青云门"]);
  });
  test("重 upsert 后旧内容搜不到(reindex)", () => {
    // jieba: "剑冢古地" → ["剑冢","古","地"]  /  "天山雪莲" → ["天山","雪莲"]
    // 两版本无共享词根,确保 DELETE+INSERT 已物理替换影子行
    loreUpsert(db, { name: "青云门", content: "剑冢古地" });
    loreUpsert(db, { name: "青云门", content: "天山雪莲" });
    expect(loreSearch(db, "剑冢")).toEqual([]);
    expect(loreSearch(db, "天山").map((d) => d.name)).toEqual(["青云门"]);
  });
});

describe("pool", () => {
  test("整行存 row_json 不拍平,抽样返回结构对象", () => {
    poolAdd(db, { pool: "掉落", row: { 名称: "铁剑", 稀有度: "普通", 属性: { 攻击: 5 } } });
    const out = poolSample(db, "掉落", 1, { rng: () => 0 });
    expect(out[0]).toEqual({ 名称: "铁剑", 稀有度: "普通", 属性: { 攻击: 5 } });
  });
  test("加权抽样确定性(rng 注入)", () => {
    poolAdd(db, { pool: "p", row: { n: "A" }, weight: 1 });
    poolAdd(db, { pool: "p", row: { n: "B" }, weight: 1 });
    poolAdd(db, { pool: "p", row: { n: "C" }, weight: 2 }); // total=4
    expect(poolSample(db, "p", 1, { rng: () => 0 })[0]).toEqual({ n: "A" });
    expect(poolSample(db, "p", 1, { rng: () => 0.99 })[0]).toEqual({ n: "C" });
  });
  test("左边界归属锁定:>= 确保边界点落在左边界元素", () => {
    poolAdd(db, { pool: "p", row: { n: "A" }, weight: 1 });
    poolAdd(db, { pool: "p", row: { n: "B" }, weight: 1 });
    poolAdd(db, { pool: "p", row: { n: "C" }, weight: 2 }); // total=4: A[0,1) B[1,2) C[2,4)
    expect(poolSample(db, "p", 1, { rng: () => 0.25 })[0]).toEqual({ n: "B" }); // x=1.0 → B 左边界
    expect(poolSample(db, "p", 1, { rng: () => 0.5 })[0]).toEqual({ n: "C" }); // x=2.0 → C 左边界
  });
  test("无放回:抽 n 个不重复", () => {
    poolAdd(db, { pool: "p", row: { n: "A" } });
    poolAdd(db, { pool: "p", row: { n: "B" } });
    poolAdd(db, { pool: "p", row: { n: "C" } });
    const seq = [0, 0, 0];
    let i = 0;
    const got = poolSample(db, "p", 3, { rng: () => seq[i++] });
    expect(got.map((r) => r.n).sort()).toEqual(["A", "B", "C"]);
  });
  test("n 超过池大小返回全部", () => {
    poolAdd(db, { pool: "p", row: { n: "A" } });
    expect(poolSample(db, "p", 5, { rng: () => 0 })).toHaveLength(1);
  });
  test("filter 按 json_extract 列过滤", () => {
    poolAdd(db, { pool: "掉落", row: { 名称: "铁剑", 类型: "武器" } });
    poolAdd(db, { pool: "掉落", row: { 名称: "丹药", 类型: "消耗" } });
    const out = poolSample(db, "掉落", 5, { filter: { 类型: "武器" }, rng: () => 0 });
    expect(out.map((r) => r.名称)).toEqual(["铁剑"]);
  });
});

describe("world_register", () => {
  test("AI 现编写入 source=ai", () => {
    const id = worldRegister(db, { pool: "随机事件", row: { 事件: "遇袭" } });
    const row = db.prepare("SELECT source FROM pool WHERE rowid=?").get(id) as { source: string };
    expect(row.source).toBe("ai");
  });
});

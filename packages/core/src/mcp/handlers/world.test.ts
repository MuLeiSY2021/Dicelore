// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/world.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { worldDocGet } from "../../store/world.js";
import { ruleUpsert } from "../../store/rule.js";
import { worldTools } from "./world.js";
import { DiceloreError } from "../../errors.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
const byName = (n: string) => worldTools.find((t) => t.name === n)!;

describe("world/rule handlers", () => {
  it("world_register(doc):写入 doc,可被 world_search 召回", () => {
    const db = freshDb();
    const reg = byName("world_register").handler(db, {
      target: "doc",
      doc: { name: "黯礁港", content: "雾锁的走私者港湾", category: "地点" },
      visible: 0,
    });
    expect(reg.ok).toBe(true);
    expect(worldDocGet(db, "黯礁港")?.content).toContain("走私者");
    const found = byName("world_search").handler(db, { query: "走私者", k: 8 });
    expect(found.docs.some((d: any) => d.name === "黯礁港")).toBe(true);
    expect(found.truncated).toBe(false);
  });

  it("world_register(pool)+world_sample:抽样回 rows", () => {
    const db = freshDb();
    byName("world_register").handler(db, {
      target: "pool", pool: { pool: "战利品", row: { 名: "金币", 量: 10 }, weight: 1 }, visible: 0,
    });
    const out = byName("world_sample").handler(db, { pool: "战利品", n: 1 });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ 名: "金币" });
  });

  it("rule_search:召回作者灌注的规则", () => {
    const db = freshDb();
    ruleUpsert(db, { name: "先攻", content: "战斗开始各掷 1d20 决定行动顺序" });
    const out = byName("rule_search").handler(db, { query: "先攻", k: 8 });
    expect(out.rules.some((r: any) => r.name === "先攻")).toBe(true);
  });

  it("world_register:target 与 payload 不匹配抛 DiceloreError(下沉校验)", () => {
    const db = freshDb();
    // target=doc 却给 pool
    expect(() => byName("world_register").handler(db, {
      target: "doc", pool: { pool: "p", row: {}, weight: 1 }, visible: 0,
    })).toThrow(DiceloreError);
    // target=pool 却给 doc
    expect(() => byName("world_register").handler(db, {
      target: "pool", doc: { name: "x", content: "y" }, visible: 0,
    })).toThrow(DiceloreError);
  });
});

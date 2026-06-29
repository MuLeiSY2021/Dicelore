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
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { loreGet } from "@dicelore/backend";
import { ruleUpsert } from "@dicelore/backend";
import { makeWorldTools } from "./world.js";
import { DiceloreError } from "@dicelore/errors";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
// 内置工具 handler 经注入 SessionBackend 调存储——按 db 造工具、handler 忽略传入的 db 形参。
const byName = (db: any, n: string) => makeWorldTools(openSessionBackend(db)).find((t) => t.name === n)!;

describe("world/rule handlers", () => {
  it("world_register(doc):写入 doc,可被 world_search 召回", () => {
    const db = freshDb();
    const reg = byName(db, "world_register").handler(db, {
      target: "doc",
      doc: { name: "黯礁港", content: "雾锁的走私者港湾", category: "地点" },
      visible: 0,
    });
    expect(reg.ok).toBe(true);
    expect(loreGet(db, "黯礁港")?.content).toContain("走私者");
    const found = byName(db, "world_search").handler(db, { query: "走私者", k: 8 });
    expect(found.docs.some((d: any) => d.name === "黯礁港")).toBe(true);
    expect(found.truncated).toBe(false);
  });

  it("world_search 出参带 rowid(可直接喂 reveal_once/world_show)", () => {
    const db = freshDb();
    byName(db, "world_register").handler(db, {
      target: "doc", doc: { name: "黯礁港", content: "雾锁的走私者港湾", category: "地点" }, visible: 0,
    });
    const found = byName(db, "world_search").handler(db, { query: "走私者", k: 8 });
    const hit = found.docs.find((d: any) => d.name === "黯礁港");
    expect(hit).toBeDefined();
    expect(typeof (hit as any).rowid).toBe("number");
    expect((hit as any).rowid).toBe(loreGet(db, "黯礁港")!.rowid);
  });

  it("world_register(pool)+world_sample:抽样回 rows", () => {
    const db = freshDb();
    byName(db, "world_register").handler(db, {
      target: "pool", pool: { pool: "战利品", row: { 名: "金币", 量: 10 }, weight: 1 }, visible: 0,
    });
    const out = byName(db, "world_sample").handler(db, { pool: "战利品", n: 1 });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ 名: "金币" });
  });

  it("rule_search:召回作者灌注的规则", () => {
    const db = freshDb();
    ruleUpsert(db, { name: "先攻", content: "战斗开始各掷 1d20 决定行动顺序" });
    const out = byName(db, "rule_search").handler(db, { query: "先攻", k: 8 });
    expect(out.rules.some((r: any) => r.name === "先攻")).toBe(true);
  });

  it("world_register:target 与 payload 不匹配抛 DiceloreError(下沉校验)", () => {
    const db = freshDb();
    // target=doc 却给 pool
    expect(() => byName(db, "world_register").handler(db, {
      target: "doc", pool: { pool: "p", row: {}, weight: 1 }, visible: 0,
    })).toThrow(DiceloreError);
    // target=pool 却给 doc
    expect(() => byName(db, "world_register").handler(db, {
      target: "pool", doc: { name: "x", content: "y" }, visible: 0,
    })).toThrow(DiceloreError);
  });
});

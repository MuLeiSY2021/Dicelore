// src/mcp/handlers/world.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../../store/db.js";
import { worldDocGet } from "../../store/world.js";
import { ruleUpsert } from "../../store/rule.js";
import { worldTools } from "./world.js";

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
});

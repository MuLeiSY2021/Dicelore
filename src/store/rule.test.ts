import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { ruleGet, ruleSearch, ruleUpsert } from "./rule.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("rule_doc", () => {
  test("首次 upsert version=1", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "判定失败必有代价", category: "裁决" });
    expect(ruleGet(db, "失败硬着陆")).toMatchObject({ name: "失败硬着陆", content: "判定失败必有代价", version: 1 });
  });
  test("热更新:同名再 upsert → 覆盖内容 + version 自增,不新增行", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "v1 内容" });
    ruleUpsert(db, { name: "失败硬着陆", content: "v2 内容" });
    expect(ruleGet(db, "失败硬着陆")).toMatchObject({ content: "v2 内容", version: 2 });
    expect(db.prepare("SELECT COUNT(*) c FROM rule_doc").get()).toMatchObject({ c: 1 });
  });
  test("FTS 检索(整段召回)", () => {
    ruleUpsert(db, { name: "失败硬着陆", content: "判定失败必有代价" });
    ruleUpsert(db, { name: "升级曲线", content: "经验与等级换算" });
    expect(ruleSearch(db, "代价").map((r) => r.name)).toEqual(["失败硬着陆"]);
  });
  test("热更新后旧内容搜不到(reindex)", () => {
    // 旧: "铁锤砸碎石板" tokens: ["铁锤","砸碎","石板"]
    // 新: "蜜糖滋润心田" tokens: ["蜜糖","滋润","心田"]
    // 两组 jieba token 零重叠,reindex 后搜旧独有词 → [] (影子行已物理替换)
    ruleUpsert(db, { name: "失败硬着陆", content: "铁锤砸碎石板" });
    ruleUpsert(db, { name: "失败硬着陆", content: "蜜糖滋润心田" });
    expect(ruleSearch(db, "铁锤")).toEqual([]);
    expect(ruleSearch(db, "蜜糖").map((r) => r.name)).toEqual(["失败硬着陆"]);
  });
});

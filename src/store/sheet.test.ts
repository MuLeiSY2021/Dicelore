import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { sheetGet, sheetList, sheetSetRaw } from "./sheet.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("sheet store", () => {
  test("set 后 get", () => {
    sheetSetRaw(db, "张三", "力量", "7", 1);
    expect(sheetGet(db, "张三", "力量")).toEqual({ entity: "张三", attr: "力量", value: "7", visible: 1 });
  });
  test("UPSERT 覆盖值,缺省 visible 保留旧值", () => {
    sheetSetRaw(db, "张三", "HP", "30", 1);
    sheetSetRaw(db, "张三", "HP", "20");
    expect(sheetGet(db, "张三", "HP")).toMatchObject({ value: "20", visible: 1 });
  });
  test("list 按前缀(整卡 / 库存子集)", () => {
    sheetSetRaw(db, "张三", "力量", "7");
    sheetSetRaw(db, "张三", "库存:药水", "3");
    sheetSetRaw(db, "李四", "力量", "5");
    expect(sheetList(db, "张三.").map((c) => c.attr).sort()).toEqual(["力量", "库存:药水"]);
    expect(sheetList(db, "张三.库存:").map((c) => c.attr)).toEqual(["库存:药水"]);
  });
  test("get 缺失返回 undefined", () => {
    expect(sheetGet(db, "无", "无")).toBeUndefined();
  });
});

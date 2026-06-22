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
import { stateGet, stateSet } from "./state.js";
import { applyMutations } from "./mutate.js";
import { watcherSet } from "./watcher.js";
import { logSince } from "./log.js";
import { DiceloreError } from "../errors.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("applyMutations", () => {
  test("标量减(带骰)→ rolled 账本 + 写回", () => {
    stateSet(db, "张三", "HP", "30");
    const r = applyMutations(db, "张三", [{ attr: "HP", op: "-", expr: "1d6" }], { rng: () => 0 }); // 1d6=1
    expect(r.applied[0]).toMatchObject({ attr: "HP", kind: "rolled", old: "30", new: "29", rolls: [1] });
    expect(stateGet(db, "张三", "HP")!.value).toBe("29");
  });
  test("赋数(=,无骰)→ set 账本", () => {
    const r = applyMutations(db, "张三", [{ attr: "金币", op: "=", expr: "100" }]);
    expect(r.applied[0]).toMatchObject({ kind: "set", old: null, new: "100" });
  });
  test("引用他者属性", () => {
    stateSet(db, "李四", "力量", "5");
    const r = applyMutations(db, "张三", [{ attr: "攻击", op: "=", expr: "{李四.力量} + 2" }]);
    expect(r.applied[0].new).toBe("7");
  });
  test("集合增(词条) → attr:词条 +N", () => {
    applyMutations(db, "张三", [{ attr: "库存", op: "+", expr: "药水*3" }]);
    expect(stateGet(db, "张三", "库存:药水")!.value).toBe("3");
  });
  test("集合减到 0 删 cell", () => {
    stateSet(db, "张三", "库存:药水", "2");
    applyMutations(db, "张三", [{ attr: "库存", op: "-", expr: "药水*2" }]);
    expect(stateGet(db, "张三", "库存:药水")).toBeUndefined();
  });
  test("赋文本", () => {
    const r = applyMutations(db, "张三", [{ attr: "状态", op: "=", expr: "中毒" }]);
    expect(r.applied[0].new).toBe("中毒");
  });
  test("非数值算术 → 整批回滚", () => {
    stateSet(db, "张三", "状态", "活着");
    expect(() => applyMutations(db, "张三", [
      { attr: "HP", op: "=", expr: "10" },
      { attr: "状态", op: "-", expr: "1" },
    ])).toThrow();
    expect(stateGet(db, "张三", "HP")).toBeUndefined(); // 回滚:第一项也没写进
    expect(logSince(db, 0)).toHaveLength(0); // event 也在事务内,一并回滚
  });
  test("{ref}*N 不被误判为词条,推回值表达式后因不支持 * 报错", () => {
    expect(() => applyMutations(db, "张三", [{ attr: "库存", op: "+", expr: "{李四.数量}*2" }])).toThrow();
  });
  test("写完触发 watcher,结果带 fired_watchers", () => {
    stateSet(db, "张三", "HP", "30");
    watcherSet(db, { condition: "{张三.HP} < 10", payload: "濒死" });
    const r = applyMutations(db, "张三", [{ attr: "HP", op: "=", expr: "5" }]);
    expect(r.fired_watchers).toEqual([{ id: 1, payload: "濒死" }]);
    expect(logSince(db, 0).some((e) => e.kind === "mutation")).toBe(true);
  });
});

it("toNum 非数值算术抛 NOT_NUMERIC", () => {
  const localDb = openDb(":memory:");
  initSchema(localDb);
  stateSet(localDb, "张三", "状态", "活着");
  try {
    applyMutations(localDb, "张三", [{ attr: "状态", op: "-", expr: "1" }]);
  } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("NOT_NUMERIC");
  }
});

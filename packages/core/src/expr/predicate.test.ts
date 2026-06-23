// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { evalPredicate } from "./predicate.js";

const refs: Record<string, string> = { "张三|HP": "20", "世界|天": "18" };
const getRef = (e: string, a: string) => refs[`${e}|${a}`];

describe("evalPredicate", () => {
  test("小于成立", () => {
    expect(evalPredicate("{张三.HP} < 30", { getRef })).toBe(true);
  });
  test("大于等于成立", () => {
    expect(evalPredicate("{世界.天} >= 18", { getRef })).toBe(true);
  });
  test("不等于", () => {
    expect(evalPredicate("{张三.HP} != 20", { getRef })).toBe(false);
  });
  test("两边都是表达式", () => {
    expect(evalPredicate("{张三.HP} <= {世界.天}", { getRef })).toBe(false);
  });
  test("缺比较算符报错", () => {
    expect(() => evalPredicate("{张三.HP}", { getRef })).toThrow();
  });
});

describe("evalPredicate has()", () => {
  test("{ns:has(...)} 走 existsMatch、不被内部 OP 切开", () => {
    const ctx = { getRef: () => undefined, existsMatch: (ns: string, conds: any[]) => ns === "state" && conds.length === 2 };
    expect(evalPredicate("{state:has(attr=敌意, value>=8)}", ctx as any)).toBe(true);
  });
  test("无 existsMatch 时 has 谓词抛错", () => {
    expect(() => evalPredicate("{state:has(x=1)}", { getRef: () => undefined } as any)).toThrow();
  });
  test("普通比较谓词仍走旧路径", () => {
    const ctx = { getRef: (e: string, a: string) => (e === "张三" && a === "HP" ? "20" : undefined) };
    expect(evalPredicate("{张三.HP} < 30", ctx as any)).toBe(true);
  });
});

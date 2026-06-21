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

import { describe, expect, test } from "vitest";
import { evalPredicate } from "./predicate.js";

const getRef = (e: string, a: string) => ({ "张三|HP": "20", "世界|天": "18" }[`${e}|${a}`]);

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

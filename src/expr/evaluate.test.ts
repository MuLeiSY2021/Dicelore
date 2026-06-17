import { describe, expect, test } from "vitest";
import { evalExpr } from "./evaluate.js";

const getRef = (e: string, a: string) => ({ "张三|力量": "7", "张三|状态": "活着" }[`${e}|${a}`]);

describe("evalExpr", () => {
  test("骰子+引用-整数,账本与总和", () => {
    const led = evalExpr("1d20 + {张三.力量} - 2", { rng: () => 0.5, getRef }); // 1d20=11
    expect(led.total).toBe(11 + 7 - 2);
    expect(led.terms).toHaveLength(3);
    expect(led.terms[0]).toMatchObject({ kind: "dice", rolls: [11], value: 11, sign: 1 });
    expect(led.terms[1]).toMatchObject({ kind: "ref", refValue: 7, value: 7 });
    expect(led.terms[2]).toMatchObject({ kind: "int", value: 2, sign: -1 });
  });
  test("引用缺失 → 报错", () => {
    expect(() => evalExpr("{李四.力量}", { getRef })).toThrow();
  });
  test("引用非数值 → 报错", () => {
    expect(() => evalExpr("{张三.状态}", { getRef })).toThrow();
  });
});

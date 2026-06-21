import { describe, expect, it, test } from "vitest";
import { evalExpr } from "./evaluate.js";
import { DiceloreError } from "../errors.js";

const refs: Record<string, string> = { "张三|力量": "7", "张三|状态": "活着" };
const getRef = (e: string, a: string) => refs[`${e}|${a}`];

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

it("evalExpr 引用不存在抛 ENTITY_NOT_FOUND", () => {
  try { evalExpr("{李四.力量}", { getRef }); } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("ENTITY_NOT_FOUND");
  }
});
it("evalExpr 引用非数值抛 NOT_NUMERIC", () => {
  try { evalExpr("{张三.状态}", { getRef }); } catch (e) {
    expect((e as DiceloreError).code).toBe("NOT_NUMERIC");
  }
});

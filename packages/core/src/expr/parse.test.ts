// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, it, test } from "vitest";
import { parseExpr } from "./parse.js";
import { DiceloreError } from "../errors.js";

describe("parseExpr", () => {
  test("骰子 + 引用 - 整数", () => {
    const terms = parseExpr("1d20 + {张三.力量} - 2");
    expect(terms).toEqual([
      { kind: "dice", sign: 1, raw: "1d20", count: 1, sides: 20 },
      { kind: "ref", sign: 1, raw: "{张三.力量}", entity: "张三", attr: "力量" },
      { kind: "int", sign: -1, raw: "2", intValue: 2 },
    ]);
  });
  test("纯常数", () => {
    expect(parseExpr("60")).toEqual([{ kind: "int", sign: 1, raw: "60", intValue: 60 }]);
  });
  test("引用属性带前缀冒号(库存:药水)", () => {
    const terms = parseExpr("{张三.库存:药水}");
    expect(terms[0]).toMatchObject({ kind: "ref", entity: "张三", attr: "库存:药水" });
  });
  test("非法 token 报错", () => {
    expect(() => parseExpr("1d20 * 2")).toThrow();
  });
});

it("parseExpr 非法 token 抛 EXPR_EVAL", () => {
  try { parseExpr("1d20 * 2"); } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("EXPR_EVAL");
  }
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, it, test } from "vitest";
import { rangeMap, rollDice, type Band } from "./index.js";
import { DiceloreError } from "../errors.js";

describe("rollDice", () => {
  test("注入定种子 rng → 确定性", () => {
    const rng = () => 0.5; // floor(0.5*6)+1 = 4
    expect(rollDice(3, 6, rng)).toEqual([4, 4, 4]);
  });
  test("count 与范围", () => {
    const seq = [0, 0.999999, 0.5];
    let i = 0;
    const rng = () => seq[i++];
    expect(rollDice(3, 20, rng)).toEqual([1, 20, 11]);
  });
  test("校验 count≥1", () => {
    expect(() => rollDice(0, 6)).toThrow();
  });
  test("校验 sides≥2", () => {
    expect(() => rollDice(1, 1)).toThrow();
  });
});

describe("rangeMap", () => {
  const bands: Band[] = [
    { label: "fail", min: 1, max: 10 },
    { label: "ok", min: 11, max: 20 },
  ];
  test("命中档", () => {
    expect(rangeMap(5, bands).label).toBe("fail");
    expect(rangeMap(11, bands).label).toBe("ok");
  });
  test("落空报错", () => {
    expect(() => rangeMap(21, bands)).toThrow();
  });
  test("区间重叠报错", () => {
    expect(() => rangeMap(5, [
      { label: "a", min: 1, max: 10 },
      { label: "b", min: 10, max: 20 },
    ])).toThrow();
  });
});

it("rollDice 非法参数抛 DIE_INVALID", () => {
  try { rollDice(0, 6); } catch (e) {
    expect(e).toBeInstanceOf(DiceloreError);
    expect((e as DiceloreError).code).toBe("DIE_INVALID");
  }
});
it("rangeMap 落空抛 RANGE_INVALID", () => {
  try { rangeMap(999, [{ label: "a", min: 1, max: 10 }]); } catch (e) {
    expect((e as DiceloreError).code).toBe("RANGE_INVALID");
  }
});

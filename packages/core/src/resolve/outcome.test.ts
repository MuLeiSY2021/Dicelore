// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { resolveOutcome } from "./outcome.js";
import { DiceloreError } from "@dicelore/errors";

const bands = [
  { label: "失败", min: 1, max: 50, consequence: "有后果" },
  { label: "成功", min: 51, max: 100, consequence: "得手" },
];

describe("resolveOutcome", () => {
  it("掷单骰并命中档位(定种 rng=0 → roll 1 → 失败档)", () => {
    const r = resolveOutcome("1d100", bands, () => 0);
    expect(r.roll).toBe(1);
    expect(r.die).toBe("1d100");
    expect(r.band.label).toBe("失败");
  });

  it("rng 接近 1 → 高 roll → 成功档", () => {
    const r = resolveOutcome("1d100", bands, () => 0.999);
    expect(r.roll).toBe(100);
    expect(r.band.label).toBe("成功");
  });

  it("非单骰串(含运算)抛 DIE_INVALID", () => {
    try { resolveOutcome("2d6+1", bands, () => 0); } catch (e) {
      expect((e as DiceloreError).code).toBe("DIE_INVALID");
    }
  });

  it("乱串抛 DIE_INVALID", () => {
    expect(() => resolveOutcome("abc", bands, () => 0)).toThrow(DiceloreError);
  });
});

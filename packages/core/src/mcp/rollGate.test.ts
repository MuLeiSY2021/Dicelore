// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/mcp/rollGate.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { setRollGate, getRollGate } from "./rollGate.js";

afterEach(() => setRollGate(undefined)); // 模块级单例,测试后复位

describe("roll-gate 接缝", () => {
  it("默认无 gate(裸 CC) → getRollGate 回 undefined", () => {
    expect(getRollGate()).toBeUndefined();
  });
  it("set 后 get 回同一函数", async () => {
    const g = async () => {};
    setRollGate(g);
    expect(getRollGate()).toBe(g);
  });
  it("set(undefined) 清除", () => {
    setRollGate(async () => {});
    setRollGate(undefined);
    expect(getRollGate()).toBeUndefined();
  });
});

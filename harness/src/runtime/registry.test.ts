// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { InMemorySessionRegistry } from "./registry.js";
import type { Session } from "./session.js";

const mk = (id: string): Session => ({ sessionId: id, kind: "dice" });

describe("InMemorySessionRegistry", () => {
  it("getOrCreate 首次建、二次复用同实例", () => {
    const reg = new InMemorySessionRegistry<Session>();
    let calls = 0;
    const a = reg.getOrCreate("s1", () => { calls += 1; return mk("s1"); });
    const b = reg.getOrCreate("s1", () => { calls += 1; return mk("s1"); });
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });
  it("get 未知返回 undefined", () => {
    expect(new InMemorySessionRegistry<Session>().get("x")).toBeUndefined();
  });
});

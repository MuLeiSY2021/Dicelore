// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { uuidv5 } from "./uuid.js";

describe("uuidv5", () => {
  it("确定性:同名同 id", () => { expect(uuidv5("凡人修仙传")).toBe(uuidv5("凡人修仙传")); });
  it("不同名不同 id", () => { expect(uuidv5("a")).not.toBe(uuidv5("b")); });
  it("形如 UUID v5", () => {
    expect(uuidv5("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

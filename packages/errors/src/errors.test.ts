// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { DiceloreError } from "./errors.js";

describe("DiceloreError", () => {
  it("携带 code / message / hint,且是 Error 子类", () => {
    const e = new DiceloreError("DIE_INVALID", "骰子非法", "用 NdS");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(DiceloreError);
    expect(e.code).toBe("DIE_INVALID");
    expect(e.message).toBe("骰子非法");
    expect(e.hint).toBe("用 NdS");
    expect(e.name).toBe("DiceloreError");
  });

  it("hint 可省略", () => {
    const e = new DiceloreError("INTERNAL", "boom");
    expect(e.hint).toBeUndefined();
  });
});

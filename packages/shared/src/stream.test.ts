// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { StreamMessageSchema, CLIENT_PROTOCOL } from "./index.js";

describe("StreamMessageSchema", () => {
  it("按 type 判别 narration_delta", () => {
    const m = StreamMessageSchema.parse({
      protocol: CLIENT_PROTOCOL, type: "narration_delta", turnId: "t1", text: "你推开门",
    });
    expect(m.type).toBe("narration_delta");
  });
  it("拒绝未知 type", () => {
    expect(() =>
      StreamMessageSchema.parse({ protocol: CLIENT_PROTOCOL, type: "bogus" }),
    ).toThrow();
  });
});

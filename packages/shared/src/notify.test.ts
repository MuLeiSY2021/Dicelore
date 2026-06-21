// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { NotifyPayloadSchema, NOTIFY_PROTOCOL } from "./index.js";

describe("NotifyPayloadSchema", () => {
  it("接受合法 mutation 通知", () => {
    const p = NotifyPayloadSchema.parse({
      protocol: NOTIFY_PROTOCOL, sessionId: "s1", seq: 1235, kind: "mutation", delta: { x: 1 },
    });
    expect(p.kind).toBe("mutation");
  });
  it("拒绝非法 kind", () => {
    expect(() =>
      NotifyPayloadSchema.parse({ protocol: NOTIFY_PROTOCOL, sessionId: "s1", seq: 1, kind: "nope" }),
    ).toThrow();
  });
});

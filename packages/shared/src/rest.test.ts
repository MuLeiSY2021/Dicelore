// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { SessionsListResponseSchema } from "./rest.js";

describe("SessionsListResponseSchema", () => {
  it("解析合法的会话列表", () => {
    const parsed = SessionsListResponseSchema.parse({
      sessions: [
        { sessionId: "demo", title: "demo", status: "active", updatedAt: 123 },
        { sessionId: "old", title: "old", status: "archived" },
      ],
    });
    expect(parsed.sessions).toHaveLength(2);
    expect(parsed.sessions[0]).toEqual({
      sessionId: "demo",
      title: "demo",
      status: "active",
      updatedAt: 123,
    });
  });

  it("非法 status 抛错", () => {
    expect(() =>
      SessionsListResponseSchema.parse({
        sessions: [{ sessionId: "x", title: "x", status: "running" }],
      }),
    ).toThrow();
  });
});

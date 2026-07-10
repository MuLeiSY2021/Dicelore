// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import {
  SessionsListResponseSchema,
  SessionKindSchema,
  CreateSessionResponseSchema,
  SessionInfoSchema,
} from "./rest.js";

describe("SessionKindSchema", () => {
  it("只认 dicegm / loregm", () => {
    expect(SessionKindSchema.parse("dicegm")).toBe("dicegm");
    expect(SessionKindSchema.parse("loregm")).toBe("loregm");
    expect(() => SessionKindSchema.parse("dice")).toThrow();
  });
});

describe("SessionsListResponseSchema（统一形状）", () => {
  it("解析合法的会话列表（含 kind + packName 必填）", () => {
    const parsed = SessionsListResponseSchema.parse({
      sessions: [
        { sessionId: "demo", kind: "dicegm", title: "demo", status: "active", packName: "黑风寨", lastActionAt: 123 },
        { sessionId: "old", kind: "loregm", title: "old", status: "archived", packName: "old" },
      ],
    });
    expect(parsed.sessions).toHaveLength(2);
    expect(parsed.sessions[0]).toEqual({
      sessionId: "demo",
      kind: "dicegm",
      title: "demo",
      status: "active",
      packName: "黑风寨",
      lastActionAt: 123,
    });
  });

  it("packName 缺失 → 抛错（C3：不可空）", () => {
    expect(() =>
      SessionsListResponseSchema.parse({
        sessions: [{ sessionId: "x", kind: "dicegm", title: "x", status: "active" }],
      }),
    ).toThrow();
  });

  it("kind 缺失 → 抛错", () => {
    expect(() =>
      SessionsListResponseSchema.parse({
        sessions: [{ sessionId: "x", title: "x", status: "active", packName: "x" }],
      }),
    ).toThrow();
  });

  it("非法 status 抛错", () => {
    expect(() =>
      SessionsListResponseSchema.parse({
        sessions: [{ sessionId: "x", kind: "dicegm", title: "x", status: "running", packName: "x" }],
      }),
    ).toThrow();
  });
});

describe("CreateSessionResponseSchema", () => {
  it("解析 { sessionId, kind }", () => {
    expect(CreateSessionResponseSchema.parse({ sessionId: "s1", kind: "dicegm" })).toEqual({
      sessionId: "s1",
      kind: "dicegm",
    });
  });
  it("缺 kind → 抛错", () => {
    expect(() => CreateSessionResponseSchema.parse({ sessionId: "s1" })).toThrow();
  });
});

describe("SessionInfoSchema（对称元信息含 kind + status）", () => {
  it("解析 { sessionId, kind, status, ended, title }", () => {
    const parsed = SessionInfoSchema.parse({ sessionId: "s1", kind: "loregm", status: "active", ended: false, title: "s1" });
    expect(parsed.kind).toBe("loregm");
    expect(parsed.status).toBe("active");
  });
});

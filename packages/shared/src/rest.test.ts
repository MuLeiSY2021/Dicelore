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

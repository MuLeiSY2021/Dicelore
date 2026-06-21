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

import { describe, it, expect } from "vitest";
import { truncateText } from "./truncate.js";

describe("truncateText", () => {
  it("短串不截断", () => {
    expect(truncateText("abc", 10)).toEqual({ text: "abc", truncated: false });
  });
  it("超限截断到 limit 长度并标 truncated", () => {
    const r = truncateText("x".repeat(50), 10);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(10);
  });
  it("默认 limit=25000", () => {
    expect(truncateText("x".repeat(25001)).truncated).toBe(true);
    expect(truncateText("x".repeat(25000)).truncated).toBe(false);
  });
});

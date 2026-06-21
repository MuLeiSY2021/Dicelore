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

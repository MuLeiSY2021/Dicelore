// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { classify, successEnvelope, errorEnvelope } from "./envelope.js";
import { DiceloreError } from "../errors.js";

describe("classify", () => {
  it("DiceloreError → 透传 code/message/hint", () => {
    expect(classify(new DiceloreError("DIE_INVALID", "骰非法", "用 NdS"))).toEqual({
      code: "DIE_INVALID", message: "骰非法", hint: "用 NdS",
    });
  });
  it("非 DiceloreError → INTERNAL,不泄漏原始 message", () => {
    const r = classify(new Error("内部栈细节"));
    expect(r.code).toBe("INTERNAL");
    expect(r.message).not.toContain("内部栈细节");
  });
});

describe("信封", () => {
  it("successEnvelope:content text + structuredContent 都在", () => {
    const env = successEnvelope({ a: 1 }, { a: 1, reminders: ["x"] });
    expect(env.isError).toBeUndefined();
    expect(env.structuredContent).toEqual({ a: 1, reminders: ["x"] });
    expect(JSON.parse(env.content[0].text)).toEqual({ a: 1 });
  });
  it("errorEnvelope:isError 且绝不带 structuredContent", () => {
    const env = errorEnvelope(new DiceloreError("RANGE_INVALID", "档位错"));
    expect(env.isError).toBe(true);
    expect("structuredContent" in env).toBe(false);
    expect(JSON.parse(env.content[0].text)).toEqual({ error: { code: "RANGE_INVALID", message: "档位错" } });
  });
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, afterEach } from "vitest";
import { postBuildMessage, createLoreSession } from "./api.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("createLoreSession", () => {
  it("命中 /sessions/loregm(POST，body 带 name) 并返回 sessionId", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "ls-new", kind: "loregm" }) });
    vi.stubGlobal("fetch", f);
    const id = await createLoreSession("黑风寨");
    expect(f).toHaveBeenCalledWith("/sessions/loregm", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: "黑风寨" });
    expect(id).toBe("ls-new");
  });

  it("name 省略时 body 为空对象", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "ls2", kind: "loregm" }) });
    vi.stubGlobal("fetch", f);
    await createLoreSession();
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({});
  });
});

describe("postBuildMessage", () => {
  it("命中 /sessions/loregm/:id/messages(POST，body 带 text) 并返回 {turnId}", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t-1" }) });
    vi.stubGlobal("fetch", f);
    const got = await postBuildMessage("ls1", "补全旅人卡");
    expect(f).toHaveBeenCalledWith("/sessions/loregm/ls1/messages", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ text: "补全旅人卡" });
    expect(got).toEqual({ turnId: "t-1" });
  });

  it("4xx 带 code → apiError 译出 code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: "no_draft" }) }));
    await expect(postBuildMessage("ls1", "x")).rejects.toThrow("no_draft");
  });

  it("5xx 无 code → 回显状态码", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    await expect(postBuildMessage("ls1", "x")).rejects.toThrow("503");
  });
});

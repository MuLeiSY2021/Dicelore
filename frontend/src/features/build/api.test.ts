// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  postBuildMessage, createLoreSession, getDraft, validateDraft, listLoreSessions, deleteLoreSession,
} from "./api.js";

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

  it("响应内联 usage 原样透出（RT-FE16 co-build per-turn usage）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      turnId: "t-2", usage: { inputTokens: 5100, outputTokens: 720, cacheReadTokens: 12400, cacheCreationTokens: 680 },
    }) }));
    const got = await postBuildMessage("ls1", "加条阵线");
    expect(got.usage).toEqual({ inputTokens: 5100, outputTokens: 720, cacheReadTokens: 12400, cacheCreationTokens: 680 });
  });
});

describe("getDraft", () => {
  it("命中 /sessions/loregm/:id/draft(GET) 返回 {files, snapshot}", async () => {
    const view = { files: [{ path: "manifest.md", content: "# x" }], snapshot: { manifest: { name: "x" }, world: {}, rules: {}, pools: {}, sheets: { cells: [] }, fronts: {}, plotlines: [], foreshadows: [], anchors: [] } };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => view });
    vi.stubGlobal("fetch", f);
    const got = await getDraft("ls1");
    expect(f).toHaveBeenCalledWith("/sessions/loregm/ls1/draft");
    expect(got.files).toHaveLength(1);
    expect(got.snapshot.manifest.name).toBe("x");
  });
});

describe("validateDraft", () => {
  it("命中 /sessions/loregm/:id/draft/validate(POST) 返回 issues 数组（RT-FE11）", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ issues: [
      { level: "warn", path: "npc.哑婆", msg: "缺 sheet 卡" },
      { level: "error", path: "manifest.clock", msg: "引用的 attr 未声明" },
    ] }) });
    vi.stubGlobal("fetch", f);
    const issues = await validateDraft("ls1");
    expect(f).toHaveBeenCalledWith("/sessions/loregm/ls1/draft/validate", expect.objectContaining({ method: "POST" }));
    expect(issues).toHaveLength(2);
    expect(issues[1].level).toBe("error");
  });
});

describe("listLoreSessions", () => {
  it("命中 /sessions/loregm(GET) 返回 sessions；缺 sessions 键兜底为空数组", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessions: [{ sessionId: "l1", kind: "loregm", status: "active", title: "黑风寨", packName: "黑风寨" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    expect(await listLoreSessions()).toHaveLength(1);
    expect(await listLoreSessions()).toEqual([]);
  });
});

describe("deleteLoreSession", () => {
  it("命中 /sessions/loregm/:id(DELETE)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", f);
    await deleteLoreSession("ls1");
    expect(f).toHaveBeenCalledWith("/sessions/loregm/ls1", expect.objectContaining({ method: "DELETE" }));
  });
});

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
  listCatalog, commitPack, createPlaySession, getCatalogFiles, validateCatalog, tagPack,
} from "./api.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("listCatalog", () => {
  it("命中 /catalog 并取 adventure 数组", async () => {
    const adventure = [{ id: "a1", name: "黑风寨", head: "c1", tags: [] }];
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ adventure }) });
    vi.stubGlobal("fetch", f);
    const got = await listCatalog();
    expect(f).toHaveBeenCalledWith("/catalog");
    expect(got).toEqual(adventure);
  });

  it("非 2xx 抛带状态码错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(listCatalog()).rejects.toThrow("500");
  });
});

describe("commitPack", () => {
  it("命中 /catalog/commit(POST，body 带 name/message/files) 并返回 {adventureId,commitId}", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ adventureId: "a1", commitId: "c1" }) });
    vi.stubGlobal("fetch", f);
    const got = await commitPack("黑风寨", "init", [{ path: "manifest.md", content: "# 黑风寨" }]);
    expect(f).toHaveBeenCalledWith("/catalog/commit", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      name: "黑风寨", message: "init", files: [{ path: "manifest.md", content: "# 黑风寨" }],
    });
    expect(got).toEqual({ adventureId: "a1", commitId: "c1" });
  });

  it("4xx 带 code → apiError 译出 code（不再只回显裸 status）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "duplicate_name" }) }));
    await expect(commitPack("x", "m", [])).rejects.toThrow("duplicate_name");
  });

  it("5xx 无 code → 回显状态码", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(commitPack("x", "m", [])).rejects.toThrow("500");
  });
});

describe("createPlaySession", () => {
  it("命中 /sessions/dicegm(POST，body 带 teamId/version) 并返回服务端生成的 sessionId", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "s-new", kind: "dicegm" }) });
    vi.stubGlobal("fetch", f);
    const sid = await createPlaySession("a1", "head");
    expect(f).toHaveBeenCalledWith("/sessions/dicegm", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ teamId: "a1", version: "head" });
    expect(sid).toBe("s-new");
  });

  it("version 省略时 body 只带 teamId", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "s2", kind: "dicegm" }) });
    vi.stubGlobal("fetch", f);
    await createPlaySession("a1");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ teamId: "a1" });
  });

  it("4xx 带 code(no_catalog) → 译出 code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: "no_catalog" }) }));
    await expect(createPlaySession("a1", "head")).rejects.toThrow("no_catalog");
  });
});

describe("getCatalogFiles", () => {
  it("默认 ref=head，命中 /catalog/:id/files?ref=head 并取 files", async () => {
    const files = [{ path: "manifest.md", content: "# x" }];
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files }) });
    vi.stubGlobal("fetch", f);
    const got = await getCatalogFiles("a1");
    expect(f).toHaveBeenCalledWith("/catalog/a1/files?ref=head");
    expect(got).toEqual(files);
  });

  it("传入显式 ref 时 URL 编码进 query", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [] }) });
    vi.stubGlobal("fetch", f);
    await getCatalogFiles("a1", "c-123");
    expect(f).toHaveBeenCalledWith("/catalog/a1/files?ref=c-123");
  });
});

describe("validateCatalog", () => {
  it("命中 /catalog/validate(POST) 并返回 {ok,issues}", async () => {
    const out = { ok: false, issues: [{ level: "error", path: "manifest.md", msg: "缺 id" }] };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => out });
    vi.stubGlobal("fetch", f);
    const got = await validateCatalog([{ path: "manifest.md", content: "# x" }]);
    expect(f).toHaveBeenCalledWith("/catalog/validate", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual(out);
  });
});

describe("tagPack", () => {
  it("命中 /catalog/:id/tag(POST，body 带 commitId/label)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    await tagPack("a1", "c1", "v1.0");
    expect(f).toHaveBeenCalledWith("/catalog/a1/tag", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ commitId: "c1", label: "v1.0" });
  });
});

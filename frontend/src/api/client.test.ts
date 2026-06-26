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
  getPresentation, listSessions, postMessage, postRoll, postChoice, postRewind, startGame, testModel, testMcp,
} from "./client.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("getPresentation", () => {
  it("命中 /sessions/:id/presentation 并返回解析后的快照", async () => {
    const snap = {
      protocol: "dicelore.client/1", sessionId: "demo", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => snap });
    vi.stubGlobal("fetch", fetchMock);

    const got = await getPresentation("demo");
    expect(fetchMock).toHaveBeenCalledWith("/sessions/demo/presentation");
    expect(got).toEqual(snap);
  });

  it("非 2xx 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getPresentation("demo")).rejects.toThrow("500");
  });
});

describe("listSessions", () => {
  it("命中 /sessions 并返回 sessions 数组", async () => {
    const sessions = [{ sessionId: "demo", title: "demo", status: "active" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessions }) });
    vi.stubGlobal("fetch", fetchMock);

    const got = await listSessions();
    expect(fetchMock).toHaveBeenCalledWith("/sessions");
    expect(got).toEqual(sessions);
  });

  it("非 2xx 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(listSessions()).rejects.toThrow("503");
  });
});

describe("postMessage / postRoll", () => {
  it("postMessage 命中 /sessions/:id/messages(POST，body 带 text)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t" }) });
    vi.stubGlobal("fetch", f);
    const got = await postMessage("s1", "我推门");
    expect(f).toHaveBeenCalledWith("/sessions/s1/messages", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ text: "我推门" });
    expect(got).toEqual({ turnId: "t" });
  });

  it("postRoll 命中 /sessions/:id/roll(POST，body 带 eventId)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t" }) });
    vi.stubGlobal("fetch", f);
    await postRoll("s1", 12);
    expect(f).toHaveBeenCalledWith("/sessions/s1/roll", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ eventId: 12 });
  });
});

// ── 主线①：掷骰 — postRoll 的 409 错误码翻译(玩家可执行提示) ────────────────
describe("主线① postRoll 错误码翻译", () => {
  it("409 no_pending_roll → 可读中文(没有待掷的骰子)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_roll" }) }));
    await expect(postRoll("s1", 5)).rejects.toThrow("没有待掷的骰子");
  });

  it("409 turn_in_progress → 可读中文(上一回合还在进行中)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "turn_in_progress" }) }));
    await expect(postRoll("s1", 5)).rejects.toThrow("还在进行中");
  });

  it("非 409(500) → 通用「掷骰失败：500」", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(postRoll("s1", 5)).rejects.toThrow("掷骰失败：500");
  });
});

// ── 主线②：选择 — postChoice 命中端点 + 409 翻译 ────────────────────────────
describe("主线② postChoice", () => {
  it("命中 /sessions/:id/choices(POST，body 带 eventId+optionIndex)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t-c" }) });
    vi.stubGlobal("fetch", f);
    const got = await postChoice("s1", 3, 1);
    expect(f).toHaveBeenCalledWith("/sessions/s1/choices", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ eventId: 3, optionIndex: 1 });
    expect(got).toEqual({ turnId: "t-c" });
  });

  it("409 no_pending_choice → 可读中文(没有待选择的选项)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_choice" }) }));
    await expect(postChoice("s1", 3, 0)).rejects.toThrow("没有待选择的选项");
  });
});

// ── kickoff：startGame 走 /start 或 404 优雅回退到喂开场 cue ──────────────────
// 注：缝B startGame 响应契约正由另一线统一，本组只断言「打到哪个端点 / 回退发生」，
// 不硬断言响应体形状(避开 {sessionId,started} vs {turnId} 之争)。
describe("startGame kickoff（端点与回退，不断言响应体形状）", () => {
  it("/start 在线(2xx) → 命中 /sessions/:id/start，不回退", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t-start" }) });
    vi.stubGlobal("fetch", f);
    await startGame("s1");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith("/sessions/s1/start", expect.objectContaining({ method: "POST" }));
  });

  it("/start 未上线(404) → 回退 POST /messages 喂开场 cue", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ turnId: "t-fallback" }) });
    vi.stubGlobal("fetch", f);
    await startGame("s1");
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toBe("/sessions/s1/start");
    expect(f.mock.calls[1][0]).toBe("/sessions/s1/messages"); // 回退路径
  });

  it("/start 其它错误(500) → 抛错(不回退)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(startGame("s1")).rejects.toThrow("500");
  });
});

describe("testModel / testMcp", () => {
  it("testModel 2xx 返回解析后的 TestResult", async () => {
    const result = { ok: true, status: 200, latencyMs: 12, message: "ok" };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", f);
    const got = await testModel({ baseUrl: "http://x", key: "k", gm: "g" });
    expect(f).toHaveBeenCalledWith("/diagnostics/model-test", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual(result);
  });

  it("testModel 非 2xx 抛带状态码错误,不把错误体当成功解析", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json }));
    await expect(testModel({ baseUrl: "http://x", key: "k", gm: "g" })).rejects.toThrow("502");
    expect(json).not.toHaveBeenCalled();
  });

  it("testMcp 2xx 返回解析后的 TestResult", async () => {
    const result = { ok: true, status: 200, message: "ok" };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", f);
    const got = await testMcp({ transport: "stdio", endpoint: "x" });
    expect(f).toHaveBeenCalledWith("/diagnostics/mcp-test", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual(result);
  });

  it("testMcp 非 2xx 抛带状态码错误", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json }));
    await expect(testMcp({ transport: "stdio", endpoint: "x" })).rejects.toThrow("500");
    expect(json).not.toHaveBeenCalled();
  });
});

describe("postRewind（SNAP-1 读档）", () => {
  it("命中 /sessions/:id/rewind(POST) 并返回 {snapshotId}", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ snapshotId: 7 }) });
    vi.stubGlobal("fetch", f);
    const got = await postRewind("demo");
    expect(f).toHaveBeenCalledWith("/sessions/demo/rewind", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual({ snapshotId: 7 });
  });

  it("409 no_snapshot → 可读中文错误（本局还没有存档）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_snapshot" }) }));
    await expect(postRewind("demo")).rejects.toThrow("本局还没有存档");
  });
});

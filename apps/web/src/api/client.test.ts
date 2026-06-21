import { describe, it, expect, vi, afterEach } from "vitest";
import { getPresentation, listSessions } from "./client.js";

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

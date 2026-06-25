// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { renderHook, act } from "@testing-library/react";
import { vi, afterEach, expect, it } from "vitest";
import { useSession } from "./useSession.js";
import { CLIENT_PROTOCOL } from "@dicelore/shared";

class FakeWS {
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  constructor(public url: string) { setTimeout(() => this.onopen?.(), 0); }
  send(d: string) { this.sent.push(d); }
  close() {}
  emit(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

afterEach(() => { vi.restoreAllMocks(); });

it("收到 narration_commit 累积叙事；roll_staged 置 pendingRoll；roll_committed 清空", async () => {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) }));

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "门开了。" }); });
  expect(result.current.narration.join("")).toContain("门开了。");

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 5, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } }); });
  expect(result.current.pendingRoll?.eventId).toBe(5);

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_committed", eventId: 5, rolls: [55], total: 55, outcome: "成功" }); });
  expect(result.current.pendingRoll).toBeNull();
});

it("postMessage 失败 → error 进 error 通道(不再静默吞)、generating 复位", async () => {
  vi.stubGlobal("WebSocket", class extends FakeWS {});
  // 首个 fetch(refetch presentation) ok，第二个(postMessage)失败
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) })
    .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "turn_in_progress" }) });
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    await expect(result.current.postMessage("我推门")).rejects.toBeTruthy();
  });
  expect(result.current.error).toBeTruthy();
  expect(result.current.generating).toBe(false);
});

it("roll 失败 → error 进 error 通道(roll 之前无 catch、静默吞)", async () => {
  vi.stubGlobal("WebSocket", class extends FakeWS {});
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) })
    .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_roll" }) });
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    await expect(result.current.roll(5)).rejects.toBeTruthy();
  });
  expect(result.current.error).toBeTruthy();
});

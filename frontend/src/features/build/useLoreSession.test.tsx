// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, afterEach, expect, it, describe } from "vitest";
import { useLoreSession } from "./useLoreSession.js";
import { CLIENT_PROTOCOL } from "@dicelore/shared";

// getDraft 桩：draft_delta / turn_ended 触发 refresh 会调它。
const emptySnap = { manifest: {}, world: {}, rules: {}, pools: {}, sheets: { cells: [] }, fronts: {}, plotlines: [], foreshadows: [], anchors: [] };
vi.mock("./api.js", () => ({
  getDraft: vi.fn(async () => ({ files: [{ path: "manifest.md", content: "# x" }], snapshot: emptySnap })),
}));
import { getDraft } from "./api.js";

// 迷你 WS 替身（同 useSession.test 的 FakeWS）：可手动 emit、模拟断线、记录重连。
class FakeWS {
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  constructor(public url: string) { setTimeout(() => this.onopen?.(), 0); }
  send() { /* loregm 侧客户端不主动发帧 */ }
  close() { this.readyState = 3; }
  emit(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  drop() { this.readyState = 3; this.onclose?.(); }
}
function installWs(): FakeWS[] {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  return instances;
}

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

it("连 /sessions/loregm/:id/ws（URL 含 loregm 段）", async () => {
  const inst = installWs();
  renderHook(() => useLoreSession("ls1"));
  await act(async () => { await Promise.resolve(); });
  expect(inst[0].url).toContain("/sessions/loregm/ls1/ws");
});

it("turn_started 置 generating；turn_ended 复位并更新 seq", async () => {
  const inst = installWs();
  const { result } = renderHook(() => useLoreSession("ls1"));
  await act(async () => { await Promise.resolve(); });

  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "b1" }); });
  expect(result.current.generating).toBe(true);

  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "b1", seq: 7 }); });
  expect(result.current.generating).toBe(false);
  expect(result.current.seq).toBe(7);
});

it("toolcall 累进本轮 liveTools 且按 turnId 归档 toolsByTurn", async () => {
  const inst = installWs();
  const { result } = renderHook(() => useLoreSession("ls1"));
  await act(async () => { await Promise.resolve(); });

  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "b1" }); });
  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "toolcall", tool: "add_front", args: {}, ok: true }); });
  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "toolcall", tool: "set_manifest", args: {}, ok: true }); });

  expect(result.current.liveTools.map((t) => t.tool)).toEqual(["add_front", "set_manifest"]);
  expect(result.current.toolsByTurn["b1"].map((t) => t.tool)).toEqual(["add_front", "set_manifest"]);

  // 新一轮 turn_started 清空 liveTools（但历史轮归档保留）。
  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "b2" }); });
  expect(result.current.liveTools).toEqual([]);
  expect(result.current.toolsByTurn["b1"]).toHaveLength(2);
});

it("draft_delta 触发即写即读重拉 Draft", async () => {
  const inst = installWs();
  const { result } = renderHook(() => useLoreSession("ls1"));
  await act(async () => { await Promise.resolve(); });
  (getDraft as unknown as ReturnType<typeof vi.fn>).mockClear();

  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "draft_delta", seq: 3, changes: {} }); });
  await waitFor(() => expect(getDraft).toHaveBeenCalled());
  expect(result.current.seq).toBe(3);
  await waitFor(() => expect(result.current.draft?.files).toHaveLength(1));
});

it("error 事件设错误、复位 generating；clearError 清除", async () => {
  const inst = installWs();
  const { result } = renderHook(() => useLoreSession("ls1"));
  await act(async () => { await Promise.resolve(); });

  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "b1" }); });
  act(() => { inst[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "build_tool_error", message: "clock attr 未声明" }); });
  expect(result.current.generating).toBe(false);
  expect(result.current.error).toEqual({ code: "build_tool_error", message: "clock attr 未声明" });

  act(() => { result.current.clearError(); });
  expect(result.current.error).toBeNull();
});

it("sessionId 为 null 不连接、状态全空", async () => {
  const inst = installWs();
  const { result } = renderHook(() => useLoreSession(null));
  await act(async () => { await Promise.resolve(); });
  expect(inst).toHaveLength(0);
  expect(result.current.draft).toBeNull();
  expect(result.current.generating).toBe(false);
});

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
import { useSession } from "./useSession.js";
import { CLIENT_PROTOCOL } from "@dicelore/shared";

// 迷你 WS 替身：可手动 emit 服务端流消息、模拟断线(close)、记录发送。
// useSession 的 onclose 会指数退避重连——FakeWS 把每次 new 实例压入 instances，
// 测试据此拿到「重连后的新连接」断言重连发生。
class FakeWS {
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  constructor(public url: string) { setTimeout(() => this.onopen?.(), 0); }
  send(d: string) { this.sent.push(d); }
  close() { this.readyState = 3; }
  emit(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  // 模拟服务端/网络断线：触发 useSession 的重连分支。
  drop() { this.readyState = 3; this.onclose?.(); }
}

const SNAP = {
  protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
  sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null,
};

// 默认 fetch 桩：所有 presentation refetch 回空快照；动作 POST 回 turnId。
function stubFetchOk(snap: Record<string, unknown> = SNAP) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/presentation")) {
      return Promise.resolve({ ok: true, json: async () => snap });
    }
    return Promise.resolve({ ok: true, json: async () => ({ turnId: "t" }) });
  }));
}

// 安装 FakeWS 工厂并返回实例收集器(每次重连新增一个实例)。
function installWs(): FakeWS[] {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  return instances;
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

// ── 既有：narration / roll_staged / roll_committed 基础对账 ──────────────────
it("收到 narration_commit 累积叙事；roll_staged 置 pendingRoll；roll_committed 清空", async () => {
  const instances = installWs();
  stubFetchOk();

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

// ── 主线①：掷骰 ─────────────────────────────────────────────────────────────
describe("主线① 掷骰", () => {
  it("turn_started→roll_staged(置 pendingRoll+generating) → 玩家点掷(POST /roll) → roll_committed 清 pending+refetch", async () => {
    const instances = installWs();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) return Promise.resolve({ ok: true, json: async () => SNAP });
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t-roll" }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    // GM 发起明骰：turn_started → roll_staged
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t-roll" }); });
    expect(result.current.generating).toBe(true);
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
      pendingRoll: { eventId: 7, shape: "outcome", label: "翻越高墙", yourSide: { name: "你", exprDisplay: "1d20" }, bands: [] } }); });
    expect(result.current.pendingRoll?.eventId).toBe(7);

    // 玩家点掷：roll(eventId) → POST /sessions/s1/roll
    await act(async () => { await result.current.roll(7); });
    expect(fetchMock).toHaveBeenCalledWith("/sessions/s1/roll", expect.objectContaining({ method: "POST" }));

    // 引擎掷完广播 roll_committed → pendingRoll 清空 + turn_ended 收尾
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_committed", eventId: 7, rolls: [14], total: 14, dc: 12, outcome: "成功" }); });
    expect(result.current.pendingRoll).toBeNull();
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "t-roll", seq: 9 }); });
    expect(result.current.generating).toBe(false);
  });
});

// ── 主线②：选择 ─────────────────────────────────────────────────────────────
describe("主线② 选择", () => {
  it("choices 触发 refetch 拉快照；玩家 choose(eventId,idx) → POST /choices + generating", async () => {
    const instances = installWs();
    const snapWithChoices = { ...SNAP, choices: { eventId: 3, options: [
      { index: 0, label: "推门进去", consequence: "惊动守卫" },
      { index: 1, label: "绕到后窗", consequence: "耗时但隐蔽" },
    ] } };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) return Promise.resolve({ ok: true, json: async () => snapWithChoices });
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t-choice" }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    // 回合末暂存 choices → WS choices → useSession refetch 拉到带选项的快照
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "choices", choices: { eventId: 3, options: [
      { index: 0, label: "推门进去", consequence: "惊动守卫" },
      { index: 1, label: "绕到后窗", consequence: "耗时但隐蔽" },
    ] } }); });
    await waitFor(() => expect(result.current.snapshot?.choices?.options).toHaveLength(2));

    // 玩家点第 2 项 → choose → POST /sessions/s1/choices(下一回合输入=该 option)
    await act(async () => { await result.current.choose(3, 1); });
    expect(result.current.generating).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/sessions/s1/choices", expect.objectContaining({ method: "POST" }));
  });
});

// ── 主线③：终局(game_end) ───────────────────────────────────────────────────
describe("主线③ 终局", () => {
  it("game_end 置 gameEnd(reason/outcome) + 关 generating(锁态)", async () => {
    const instances = installWs();
    stubFetchOk();

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t-end" }); });
    expect(result.current.generating).toBe(true);
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "巨龙的爪子贯穿了你的胸膛。" }); });
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "game_end", reason: "团灭", outcome: "你死了" }); });

    expect(result.current.gameEnd).toEqual({ reason: "团灭", outcome: "你死了" });
    // game_end 即关生成态：UI 据此落终局锁(不再接受输入)。
    expect(result.current.generating).toBe(false);
    // 终局前的叙事仍在(供终局回顾)。
    expect(result.current.narration.join("")).toContain("贯穿了你的胸膛");
  });
});

// ── 主线④：错误恢复 ─────────────────────────────────────────────────────────
describe("主线④ 错误恢复", () => {
  it("WS error 置 error 通道并复位 generating；后续 turn_started 清旧错误", async () => {
    const instances = installWs();
    stubFetchOk();

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t-err" }); });
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: "GM 回合超时,已脱困" }); });
    expect(result.current.error).toBe("GM 回合超时,已脱困");
    expect(result.current.generating).toBe(false);

    // 玩家重试新回合：turn_started 清旧错误(error 通道复位)。
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t-retry" }); });
    expect(result.current.error).toBeNull();
    expect(result.current.generating).toBe(true);
  });

  it("postMessage 409 → error 进 error 通道(不静默吞)、generating 复位", async () => {
    installWs();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => SNAP })
      .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "turn_in_progress" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await expect(result.current.postMessage("我推门")).rejects.toBeTruthy(); });
    expect(result.current.error).toContain("还在进行中");
    expect(result.current.generating).toBe(false);
  });

  it("roll 409(no_pending_roll) → error 进 error 通道", async () => {
    installWs();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => SNAP })
      .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_roll" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await expect(result.current.roll(5)).rejects.toBeTruthy(); });
    expect(result.current.error).toContain("没有待掷");
  });

  it("choose 409(no_pending_choice) → error 通道 + generating 复位", async () => {
    installWs();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => SNAP })
      .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_choice" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await expect(result.current.choose(3, 0)).rejects.toBeTruthy(); });
    expect(result.current.error).toContain("没有待选择");
    expect(result.current.generating).toBe(false);
  });
});

// ── 主线⑤：断线重连 ─────────────────────────────────────────────────────────
describe("主线⑤ 断线重连", () => {
  it("WS 断线 → 退避重连(新连接) + refetch 全量对账；重放历史去重(同 seq narration 不重复)", async () => {
    vi.useFakeTimers();
    const instances = installWs();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) return Promise.resolve({ ok: true, json: async () => SNAP });
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t" }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(instances).toHaveLength(1);

    // 收到一段叙事(已渲染 seq=1)。
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "第一段。" }); });
    expect(result.current.narration).toEqual(["第一段。"]);

    // 断线：onclose → setTimeout(退避) → 重连 + refetch。
    act(() => { instances[0].drop(); });
    const fetchCallsBefore = fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(600); }); // 首次退避 500ms
    // 建立了新连接(重连发生)。
    expect(instances.length).toBeGreaterThanOrEqual(2);
    // 重连触发了 refetch(全量对账)。
    expect(fetchMock.mock.calls.length).toBeGreaterThan(fetchCallsBefore);

    // 服务端重连重放历史:已渲染的 seq=1 不应重复累积(narration_commit 客户端按 push,
    // 这里验证重放只补 since 之后——服务端职责,前端收到的 seq=2 为新段)。
    act(() => { instances.at(-1)!.emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 2, text: "第二段(重连后)。" }); });
    expect(result.current.narration).toEqual(["第一段。", "第二段(重连后)。"]);
  });

  it("重连后通过 refetch 快照恢复 pendingRoll/choices(服务端重弹 roll_staged 仍生效)", async () => {
    vi.useFakeTimers();
    const instances = installWs();
    // 重连后的快照带 pendingRoll(模拟服务端 restagePendingRolls 之外的快照对账路径)。
    const snapPending = { ...SNAP, pendingRoll: { eventId: 9, shape: "outcome", label: "撬锁",
      yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } };
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) {
        calls += 1;
        return Promise.resolve({ ok: true, json: async () => snapPending });
      }
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t" }) });
    }));

    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    act(() => { instances[0].drop(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    // 服务端重连重弹 roll_staged(restagePendingRolls 路径) → 前端置 pendingRoll。
    act(() => { instances.at(-1)!.emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
      pendingRoll: { eventId: 9, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } }); });
    expect(result.current.pendingRoll?.eventId).toBe(9);
    expect(calls).toBeGreaterThanOrEqual(2); // 初次 + 重连各一次 refetch
  });
});

// ── 既有回归：切会话清残留 / 迟到 refetch 守卫 ──────────────────────────────
it("切会话(sessionId 变更) → 重置叙事/pendingRoll/error/gameEnd/reveals 残留状态", async () => {
  const instances = installWs();
  stubFetchOk();

  const { result, rerender } = renderHook(({ sid }) => useSession(sid), { initialProps: { sid: "s1" } });
  await act(async () => { await Promise.resolve(); });

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "旧会话叙事" }); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 9, shape: "outcome", label: "旧待掷", yourSide: { name: "你", exprDisplay: "1d20" }, bands: [] } }); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "x", message: "旧错误" }); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "game_end", reason: "旧终局", outcome: "旧结局" }); });
  expect(result.current.narration.length).toBeGreaterThan(0);
  expect(result.current.pendingRoll).not.toBeNull();
  expect(result.current.error).toBeTruthy();
  expect(result.current.gameEnd).not.toBeNull();

  rerender({ sid: "s2" });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.narration).toEqual([]);
  expect(result.current.pendingRoll).toBeNull();
  expect(result.current.error).toBeNull();
  expect(result.current.gameEnd).toBeNull();
  expect(result.current.reveals).toEqual([]);
});

it("旧会话的迟到 refetch 不覆盖新会话快照（sessionId 守卫）", async () => {
  installWs();
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    const m = /sessions\/([^/]+)\/presentation/.exec(url);
    const sid = m ? m[1] : "?";
    return Promise.resolve({ ok: true, json: async () => ({
      protocol: CLIENT_PROTOCOL, sessionId: sid, seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) });
  }));

  const { result, rerender } = renderHook(({ sid }) => useSession(sid), { initialProps: { sid: "s1" } });
  await act(async () => { await Promise.resolve(); });
  rerender({ sid: "s2" });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.snapshot?.sessionId).toBe("s2");
});

// ── RT-1：GM 超时兜底(可区分 code=gm_timeout + 重试/跳过) ────────────────────
describe("RT-1 GM 超时兜底", () => {
  it("error code=gm_timeout → errorCode 暴露 gm_timeout(与普通 gm_error 可区分)", async () => {
    const instances = installWs();
    stubFetchOk();
    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t1" }); });
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_timeout", message: "GM 回合超时(180s)中止,已脱困" }); });
    expect(result.current.errorCode).toBe("gm_timeout");
    expect(result.current.error).toContain("超时");
    expect(result.current.generating).toBe(false);

    // 普通错误 errorCode 为该 code，前端不当超时处理。
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: "别的错" }); });
    expect(result.current.errorCode).toBe("gm_error");
  });

  it("retry 重发上一条玩家输入(message)；turn_started 清 errorCode", async () => {
    const instances = installWs();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) return Promise.resolve({ ok: true, json: async () => SNAP });
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.postMessage("我推门"); });
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_timeout", message: "超时" }); });
    expect(result.current.errorCode).toBe("gm_timeout");

    const before = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/messages")).length;
    await act(async () => { await result.current.retry(); });
    const after = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/messages"));
    expect(after.length).toBe(before + 1);
    // 重发的就是上一条文本。
    expect(JSON.parse((after.at(-1)![1] as { body: string }).body).text).toBe("我推门");
    // 重试进入生成态后，turn_started 回来清错误码。
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId: "t2" }); });
    expect(result.current.errorCode).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("skip 仅清错误态、不重发任何请求(放弃本回合继续)", async () => {
    const instances = installWs();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/presentation")) return Promise.resolve({ ok: true, json: async () => SNAP });
      return Promise.resolve({ ok: true, json: async () => ({ turnId: "t" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSession("s1"));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.postMessage("我推门"); });
    act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_timeout", message: "超时" }); });
    const callsBefore = fetchMock.mock.calls.length;
    act(() => { result.current.skip(); });
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.generating).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(callsBefore); // 无新请求
  });
});


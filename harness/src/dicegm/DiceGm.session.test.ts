// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// gm-session-continuity：DiceGm 适配器层 offline 单测（mock SDK query，不烧 LLM）。
// 覆盖两点无法在 DiceSession 层验的适配逻辑：
//  ① SDK system init 携带的 session_id 被上抛为 sdk_session TurnEvent；
//  ② resume 续接失败（本回合带 resume 却抛错）→ catch 报 code=gm_resume_failed 的可辨识 error（C4：报错、非静默 fallback）。

import { describe, it, expect, vi } from "vitest";

// 可控 query 实现：每个用例改 impl.fn 决定 SDK 流出的消息 / 抛错。
const impl: { fn: (arg: unknown) => AsyncIterable<unknown> } = {
  fn: () => (async function* () {})(),
};
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (arg: unknown) => impl.fn(arg),
}));

import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { createMcpServer } from "@dicelore/harness";
import { DiceGm } from "./DiceGm.js";
import type { AgentInit, TurnEvent } from "../runtime/agent.js";

function makeGm(extra: Partial<AgentInit> = {}): DiceGm {
  const db = openDb(":memory:");
  initSchema(db);
  const mcpServer = createMcpServer(openSessionBackend(db), db, {});
  return new DiceGm({ mcpServer, openingPrompt: "你是 GM。", ...extra });
}

async function collect(gm: DiceGm, text: string): Promise<TurnEvent[]> {
  const out: TurnEvent[] = [];
  for await (const e of gm.runTurn({ text, turnId: "t1" })) out.push(e);
  return out;
}

describe("DiceGm gm-session-continuity（适配器层）", () => {
  it("SDK system init 的 session_id → 上抛 sdk_session 事件", async () => {
    impl.fn = () => (async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-abc-123", model: "glm-5.2" };
      yield { type: "result", subtype: "success", usage: { input_tokens: 10, output_tokens: 3 } };
    })();
    const events = await collect(makeGm(), "开局");
    expect(events).toContainEqual({ type: "sdk_session", id: "sdk-abc-123" });
    expect(events.some((e) => e.type === "usage")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "turn_end" });
  });

  it("system init 无 session_id → 不上抛 sdk_session（不阻断,下回合再采）", async () => {
    impl.fn = () => (async function* () {
      yield { type: "system", subtype: "init", model: "glm-5.2" }; // 无 session_id
      yield { type: "result", subtype: "success", usage: {} };
    })();
    const events = await collect(makeGm(), "开局");
    expect(events.some((e) => e.type === "sdk_session")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "turn_end" });
  });

  it("本回合带 resume 却抛错 → error code=gm_resume_failed（报历史丢失·需开新局）", async () => {
    impl.fn = () => (async function* () {
      throw new Error("session sdk-old not found");
      // eslint-disable-next-line no-unreachable
      yield undefined;
    })();
    const events = await collect(makeGm({ resume: "sdk-old" }), "第二回合");
    const err = events.find((e) => e.type === "error") as Extract<TurnEvent, { type: "error" }> | undefined;
    expect(err).toBeTruthy();
    expect(err!.code).toBe("gm_resume_failed");
    expect(err!.message).toContain("历史记录丢失");
  });

  it("不带 resume 抛错 → 一般驱动错误(无 gm_resume_failed code)", async () => {
    impl.fn = () => (async function* () {
      throw new Error("connection reset");
      // eslint-disable-next-line no-unreachable
      yield undefined;
    })();
    const events = await collect(makeGm(), "首回合");
    const err = events.find((e) => e.type === "error") as Extract<TurnEvent, { type: "error" }> | undefined;
    expect(err).toBeTruthy();
    expect(err!.code).toBeUndefined();
    expect(err!.message).toBe("connection reset");
  });
});

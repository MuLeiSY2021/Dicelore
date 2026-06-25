// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { openDb, initSchema, metaSet, setRollGate, getRollGate, type DB } from "@dicelore/core";
import { DiceSession, TurnInProgressError } from "./DiceSession.js";
import { FakeDiceGm } from "./FakeDiceGm.js";
import type { AgentInit, Agent } from "../pkg/agent.js";

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };
function appendLog(db: DB, kind: string, opts: { content?: string; visible?: number; data_json?: unknown } = {}): number {
  const info = db.prepare("INSERT INTO log (content, kind, data_json, visible) VALUES (?, ?, ?, ?)")
    .run(opts.content ?? null, kind, opts.data_json === undefined ? null : JSON.stringify(opts.data_json), opts.visible ?? 1);
  return Number(info.lastInsertRowid);
}

describe("DiceSession", () => {
  it("handleMessage 跑一回合：WS 收到 turn_started…turn_ended", async () => {
    const host = new DiceSession("s1", {
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]),
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const { turnId } = await host.handleMessage("我推门");
    const types = sent.map((m) => m.type);
    expect(turnId).toBeTruthy();
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit");
    expect(types.at(-1)).toBe("turn_ended");
  });

  it("onCanonWrite 经 hub 推 presentation_delta", async () => {
    const host = new DiceSession("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "mutation", seq: 7, toolName: "sheet_update", output: {} });
    expect(sent.find((m) => m.type === "presentation_delta")?.delta.seq).toBe(7);
  });

  // A1：narrate event → narration_commit，text 由 DiceSession 从 log 行(按 evt.seq)取出。
  it("onCanonWrite(narrate) 从 log 行补 text → narration_commit", () => {
    const db = memDb();
    const seq = appendLog(db, "narrate", { content: "门吱呀一声开了。" });
    const host = new DiceSession("s-narr", { agentFactory: () => new FakeDiceGm([]), db });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "event", seq, toolName: "narrate", output: { event_id: seq } });
    const msg = sent.find((m) => m.type === "narration_commit");
    expect(msg).toBeTruthy();
    expect(msg.seq).toBe(seq); // 全局 event seq(对齐 narrativeCursor)
    expect(msg.text).toBe("门吱呀一声开了。");
  });

  // B3：game_end event → game_end，reason/outcome 由 DiceSession 从 session_meta 取出。
  it("onCanonWrite(game_end) 从 session_meta 补 reason/outcome → game_end", () => {
    const db = memDb();
    const seq = appendLog(db, "note", { visible: 0, data_json: { reason: "团灭", outcome: "你死了" } });
    metaSet(db, "ended", JSON.stringify({ reason: "团灭", outcome: "你死了", seq }));
    const host = new DiceSession("s-end", { agentFactory: () => new FakeDiceGm([]), db });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "game_end", seq, toolName: "game_end", output: { ended: true, event_id: seq } });
    const msg = sent.find((m) => m.type === "game_end");
    expect(msg).toBeTruthy();
    expect(msg.reason).toBe("团灭");
    expect(msg.outcome).toBe("你死了");
  });

  it("handleRoll 对无待掷返回 false", () => {
    const host = new DiceSession("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    expect(host.handleRoll(999)).toBe(false);
  });

  // B1：handleChoice 走正式路径——落「玩家所选」记录 + 据所选作下一回合 TurnInput(不伪装 [choice] 文本)。
  it("handleChoice 据所选 option 作下一回合输入 + 落玩家选择记录(非伪装文本)", async () => {
    const db = memDb();
    // 预置一条已物化的 kind=choice event(turn-end hook 物化后形状)。
    const eventId = appendLog(db, "choice", {
      content: "门口分叉",
      data_json: { prompt: "门口分叉", options: [
        { label: "推门进去", consequence: "惊动守卫" },
        { label: "绕到后窗", consequence: "耗时但隐蔽" },
      ] },
    });
    let capturedInput = "";
    const host = new DiceSession("s-choice", {
      db,
      agentFactory: () => ({ async *runTurn(input: { text: string }) { capturedInput = input.text; yield { type: "turn_end" }; } }) as Agent,
    });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const { turnId } = await host.handleChoice(eventId, 1);
    expect(turnId).toBeTruthy();
    // 下一回合输入来自所选 option(label)——不是伪装的 "[choice …#…]" 文本。
    expect(capturedInput).toContain("绕到后窗");
    expect(capturedInput).not.toMatch(/^\[choice /);
    // 落了「玩家所选」记录(可被快照/历史复原)。
    const chosen = db.prepare("SELECT content, data_json FROM log WHERE kind='note' AND data_json LIKE '%player_choice%'").get() as { content: string; data_json: string } | undefined;
    expect(chosen).toBeTruthy();
    const dj = JSON.parse(chosen!.data_json);
    expect(dj.player_choice).toMatchObject({ eventId, optionIndex: 1, label: "绕到后窗" });
  });

  it("handleChoice 对越界 optionIndex / 无此 choice 抛错(不开回合)", async () => {
    const db = memDb();
    const host = new DiceSession("s-choice-bad", { db, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    await expect(host.handleChoice(999, 0)).rejects.toThrow();
  });
});

describe("DiceSession 会话级并发互斥(RT-2)", () => {
  // 可控延迟 agent：runTurn 卡在一个外部 Promise 上，直到 release() 才结束——
  // 用于制造「上一回合仍在跑」的窗口，验证并发入口被拒。
  function suspendableAgent(): { agent: Agent; release: () => void; started: Promise<void> } {
    let release!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const started = new Promise<void>((r) => { markStarted = r; });
    const agent: Agent = {
      async *runTurn() {
        markStarted();
        await gate;
        yield { type: "turn_end" };
      },
    };
    return { agent, release, started };
  }

  it("上一回合在跑时，handleMessage 并发调用抛 TurnInProgressError", async () => {
    const { agent, release, started } = suspendableAgent();
    const host = new DiceSession("s-mutex", { agentFactory: () => agent, db: memDb() });
    const first = host.handleMessage("第一回合"); // 不 await，让它挂起
    await started; // 确保第一回合已进入 runTurn
    await expect(host.handleMessage("并发第二回合")).rejects.toBeInstanceOf(TurnInProgressError);
    release();
    await first; // 第一回合正常结束
  });

  it("并发 handleChoice / start 同样被互斥拒绝", async () => {
    const { agent, release, started } = suspendableAgent();
    const host = new DiceSession("s-mutex2", { agentFactory: () => agent, db: memDb() });
    const first = host.handleMessage("占住");
    await started;
    await expect(host.handleChoice(1, 0)).rejects.toBeInstanceOf(TurnInProgressError);
    await expect(host.start()).rejects.toBeInstanceOf(TurnInProgressError);
    release();
    await first;
  });

  it("回合结束后互斥释放，下一回合可正常跑（含上一回合 throw 后）", async () => {
    const host = new DiceSession("s-mutex3", {
      agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]),
      db: memDb(),
    });
    const r1 = await host.handleMessage("回合一");
    expect(r1.turnId).toBeTruthy();
    const r2 = await host.handleMessage("回合二"); // 上一回合已释放
    expect(r2.turnId).toBeTruthy();
    expect(r1.turnId).not.toBe(r2.turnId);
  });

  it("回合内 agent 出错(errored)后互斥仍释放（finally）——之后可开新回合", async () => {
    let first = true;
    const host = new DiceSession("s-mutex4", {
      agentFactory: () => ({
        async *runTurn() {
          if (first) { first = false; throw new Error("回合内炸"); }
          yield { type: "turn_end" };
        },
      }) as Agent,
      db: memDb(),
    });
    // streamDriverTurn 把 agent 错误吞成 errored 返回（不向上抛），handleMessage 正常 resolve；
    // 关键是互斥在 finally 释放——下一回合不被误判为 in-flight。
    await host.handleMessage("炸的回合");
    const r = await host.handleMessage("正常回合");
    expect(r.turnId).toBeTruthy();
  });
});

describe("DiceSession debug(明骰降级)", () => {
  // L3:DiceSession 无条件注入 rollGate 让 core 的「无 gate 降级立即掷」成死代码,
  // eval/裸 CC 调明骰必卡死(等永不来的 POST /roll)。debug 模式不注入 gate → core 降级立即掷。
  beforeEach(() => setRollGate(undefined));

  it("debug:true → 不注入 rollGate(core 降级路径激活)", () => {
    const s = new DiceSession("s-debug", { agentFactory: () => new FakeDiceGm([]), db: memDb(), debug: true });
    expect(s.gate).toBeUndefined();
    expect(getRollGate()).toBeUndefined();
  });

  it("默认(非 debug) → 注入 rollGate(等玩家掷)", () => {
    const s = new DiceSession("s-nodebug", { agentFactory: () => new FakeDiceGm([]), db: memDb() });
    expect(s.gate).toBeDefined();
    expect(getRollGate()).toBeDefined();
  });

  it("debug:true → handleRoll 无 gate 直接 false(明骰已立即掷,无 pending)", () => {
    const s = new DiceSession("s-debug-roll", { agentFactory: () => new FakeDiceGm([]), db: memDb(), debug: true });
    expect(s.handleRoll(999)).toBe(false);
  });
});

describe("DiceSession baseline", () => {
  it("baseline:true → openingPrompt 去教条(不含形状表)", () => {
    const s = new DiceSession("t-bl-1", { agentFactory: () => ({ async *runTurn() {} }) as Agent, db: memDb(), baseline: true });
    expect(s.openingPrompt).toContain("Dicelore GM");
    expect(s.openingPrompt).not.toContain("形状表");
  });

  it("baseline:true → handleMessage 给 agentFactory 的 skills=[];非 baseline 用 deps.skills", async () => {
    let captured: AgentInit | null = null;
    const fac = (init: AgentInit): Agent => {
      captured = init;
      return { async *runTurn() { yield { type: "turn_end" } } };
    };
    const s = new DiceSession("t-bl-2", { agentFactory: fac, db: memDb(), baseline: true, skills: [{ name: "x", srcDir: "/x" }] });
    await s.handleMessage("hi");
    expect(captured!.skills).toEqual([]);

    const s2 = new DiceSession("t-bl-3", { agentFactory: fac, db: memDb(), skills: [{ name: "x", srcDir: "/x" }] });
    await s2.handleMessage("hi");
    expect(captured!.skills).toEqual([{ name: "x", srcDir: "/x" }]);
  });
});

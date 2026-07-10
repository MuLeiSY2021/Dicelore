// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema, metaSet, listSnapshots, checkpoint, openSessionBackend, type DB } from "@dicelore/backend";
import { setRollGate, getRollGate, sessionDir, SessionTranscript } from "@dicelore/harness";
import { DiceSession, TurnInProgressError, type DiceSessionDeps } from "./DiceSession.js";
import { FakeDiceGm } from "./FakeDiceGm.js";
import type { AgentInit, Agent } from "../runtime/agent.js";

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };
// 组合根注入 helper(测试侧):据可选 db 建 {db, backend} 注入,缺 db 则内存库。
// DiceSession 不再自开库(storage-port ADR §4),测试经此模拟组合根的注入。
function newDice(id: string, deps: Omit<DiceSessionDeps, "db" | "backend"> & { db?: DB }): DiceSession {
  const db = deps.db ?? memDb();
  return new DiceSession(id, { ...deps, db, backend: openSessionBackend(db) });
}
function appendLog(db: DB, kind: string, opts: { content?: string; visible?: number; data_json?: unknown } = {}): number {
  const info = db.prepare("INSERT INTO log (content, kind, data_json, visible) VALUES (?, ?, ?, ?)")
    .run(opts.content ?? null, kind, opts.data_json === undefined ? null : JSON.stringify(opts.data_json), opts.visible ?? 1);
  return Number(info.lastInsertRowid);
}

describe("DiceSession", () => {
  it("handleMessage 跑一回合：WS 收到 turn_started…turn_ended", async () => {
    const host = newDice("s1", {
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
    const host = newDice("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "mutation", seq: 7, toolName: "sheet_update", output: {} });
    expect(sent.find((m) => m.type === "presentation_delta")?.delta.seq).toBe(7);
  });

  // A1：narrate event → narration_commit，text 由 DiceSession 从 log 行(按 evt.seq)取出。
  it("onCanonWrite(narrate) 从 log 行补 text → narration_commit", () => {
    const db = memDb();
    const seq = appendLog(db, "narrate", { content: "门吱呀一声开了。" });
    const host = newDice("s-narr", { agentFactory: () => new FakeDiceGm([]), db });
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
    const host = newDice("s-end", { agentFactory: () => new FakeDiceGm([]), db });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "game_end", seq, toolName: "game_end", output: { ended: true, event_id: seq } });
    const msg = sent.find((m) => m.type === "game_end");
    expect(msg).toBeTruthy();
    expect(msg.reason).toBe("团灭");
    expect(msg.outcome).toBe("你死了");
  });

  it("handleRoll 对无待掷返回 false", () => {
    const host = newDice("s1", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
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
    const host = newDice("s-choice", {
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
    const host = newDice("s-choice-bad", { db, agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]) });
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
    const host = newDice("s-mutex", { agentFactory: () => agent, db: memDb() });
    const first = host.handleMessage("第一回合"); // 不 await，让它挂起
    await started; // 确保第一回合已进入 runTurn
    await expect(host.handleMessage("并发第二回合")).rejects.toBeInstanceOf(TurnInProgressError);
    release();
    await first; // 第一回合正常结束
  });

  it("并发 handleChoice / start 同样被互斥拒绝", async () => {
    const { agent, release, started } = suspendableAgent();
    const host = newDice("s-mutex2", { agentFactory: () => agent, db: memDb() });
    const first = host.handleMessage("占住");
    await started;
    await expect(host.handleChoice(1, 0)).rejects.toBeInstanceOf(TurnInProgressError);
    await expect(host.start()).rejects.toBeInstanceOf(TurnInProgressError);
    release();
    await first;
  });

  it("回合结束后互斥释放，下一回合可正常跑（含上一回合 throw 后）", async () => {
    const host = newDice("s-mutex3", {
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
    const host = newDice("s-mutex4", {
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
    const s = newDice("s-debug", { agentFactory: () => new FakeDiceGm([]), db: memDb(), debug: true });
    expect(s.gate).toBeUndefined();
    expect(getRollGate()).toBeUndefined();
  });

  it("默认(非 debug) → 注入 rollGate(等玩家掷)", () => {
    const s = newDice("s-nodebug", { agentFactory: () => new FakeDiceGm([]), db: memDb() });
    expect(s.gate).toBeDefined();
    expect(getRollGate()).toBeDefined();
  });

  it("debug:true → handleRoll 无 gate 直接 false(明骰已立即掷,无 pending)", () => {
    const s = newDice("s-debug-roll", { agentFactory: () => new FakeDiceGm([]), db: memDb(), debug: true });
    expect(s.handleRoll(999)).toBe(false);
  });
});

describe("DiceSession 快照（SNAP-1：turnEnd 自动 checkpoint + rewind 读档）", () => {
  it("跑完一回合 → 自动落一份快照（存档语义）", async () => {
    const db = memDb();
    const host = newDice("s-snap-1", {
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]),
      db,
    });
    expect(listSnapshots(db)).toHaveLength(0);
    await host.handleMessage("我推门");
    expect(listSnapshots(db)).toHaveLength(1); // 回合边界自动写一份
    await host.handleMessage("我再推");
    expect(listSnapshots(db)).toHaveLength(2); // 每回合一份
  });

  it("rewind 读档 → 整表覆写 sheet 域回到最近快照态", async () => {
    const db = memDb();
    const host = newDice("s-snap-2", {
      agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]),
      db,
    });
    db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP','10')").run();
    await host.handleMessage("回合一"); // 此时快照存了 HP=10

    // 回合后玩家/GM 改了状态
    db.prepare("UPDATE state SET value='3' WHERE entity='你' AND attr='HP'").run();
    db.prepare("INSERT INTO state (entity, attr, value) VALUES ('你','金币','99')").run();

    const res = await host.rewind();
    expect(res?.snapshotId).toBeTruthy();
    const hp = (db.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v;
    expect(hp).toBe("10"); // 回到快照值
    expect(db.prepare("SELECT value FROM state WHERE entity='你' AND attr='金币'").get()).toBeUndefined(); // 新增行被抹
  });

  it("无快照（未跑过回合）→ rewind 返回 null（API 层映射 409）", async () => {
    const host = newDice("s-snap-3", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), db: memDb() });
    expect(await host.rewind()).toBeNull();
  });
});

// TR3：rewindTo（按 transcript uuid 回退，dice-db RollbackHook 复位领域态 + 移 HEAD）。
describe("DiceSession.rewindTo（TR3：锤到 transcript uuid）", () => {
  function newDiceWithDir(id: string): { host: DiceSession; db: DB; dir: string } {
    const db = memDb();
    const dir = mkdtempSync(join(tmpdir(), "tr3-ds-"));
    const host = new DiceSession(id, {
      db, backend: openSessionBackend(db),
      agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]),
      sessionsDir: dir,
    });
    return { host, db, dir };
  }

  it("rewindTo 复位领域态回锚点 + 挪 transcript HEAD 到该 uuid", async () => {
    const id = "s-rt-1";
    const { host, db, dir } = newDiceWithDir(id);
    const t = new SessionTranscript({ sessionDir: sessionDir(dir, "dice", id), sessionId: id });

    db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP','10')").run();
    const uuidA = t.turnEnd("t1");
    checkpoint(db, { turnSeq: 1, anchorUuid: uuidA });
    t.turnEnd("t2"); // 推进 HEAD
    db.prepare("UPDATE state SET value='3' WHERE entity='你' AND attr='HP'").run();

    const r = await host.rewindTo(uuidA);
    expect(r.uuid).toBe(uuidA);
    expect((db.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v).toBe("10");
    const head = new SessionTranscript({ sessionDir: sessionDir(dir, "dice", id), sessionId: id }).head();
    expect(head).toBe(uuidA);
  });

  it("rewindTo 锚点无 db 快照 → 抛 no_snapshot_for_anchor（HEAD 不动）", async () => {
    const id = "s-rt-2";
    const { host, dir } = newDiceWithDir(id);
    const t = new SessionTranscript({ sessionDir: sessionDir(dir, "dice", id), sessionId: id });
    const uuid = t.turnEnd("t1"); // 树内节点但无 checkpoint
    await expect(host.rewindTo(uuid)).rejects.toThrow(/no_snapshot_for_anchor/);
    // HEAD 仍在该节点（未被回退，只是找不到快照）——树未被破坏。
    expect(new SessionTranscript({ sessionDir: sessionDir(dir, "dice", id), sessionId: id }).head()).toBe(uuid);
  });

  it("rewindTo uuid 不在 transcript 树内 → 抛错", async () => {
    const id = "s-rt-3";
    const { host, dir } = newDiceWithDir(id);
    const t = new SessionTranscript({ sessionDir: sessionDir(dir, "dice", id), sessionId: id });
    t.turnEnd("t1");
    await expect(host.rewindTo("not-in-tree")).rejects.toThrow(/不在 transcript 树内/);
  });

  it("无 sessionsDir → rewindTo 抛 no_transcript（本会话无 transcript）", async () => {
    const host = newDice("s-rt-4", { agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), db: memDb() });
    await expect(host.rewindTo("any")).rejects.toThrow(/no_transcript/);
  });
});

describe("DiceSession baseline", () => {
  it("baseline:true → openingPrompt 去教条(不含形状表)", () => {
    const s = newDice("t-bl-1", { agentFactory: () => ({ async *runTurn() {} }) as Agent, db: memDb(), baseline: true });
    expect(s.openingPrompt).toContain("Dicelore GM");
    expect(s.openingPrompt).not.toContain("形状表");
  });

  it("baseline:true → handleMessage 给 agentFactory 的 plugin=undefined;非 baseline 用 deps.plugin", async () => {
    let captured: AgentInit | null = null;
    const fac = (init: AgentInit): Agent => {
      captured = init;
      return { async *runTurn() { yield { type: "turn_end" } } };
    };
    const P = { pluginDir: "/data/dice", skills: "all" as const };
    const s = newDice("t-bl-2", { agentFactory: fac, db: memDb(), baseline: true, plugin: P });
    await s.handleMessage("hi");
    expect(captured!.plugin).toBeUndefined();

    const s2 = newDice("t-bl-3", { agentFactory: fac, db: memDb(), plugin: P });
    await s2.handleMessage("hi");
    expect(captured!.plugin).toEqual(P);
  });
});

// gm-session-continuity：一个团本一个 SDK session（resume 续接 LLM 历史）。
// DiceGm 从 SDK system init 取 session_id 上抛（sdk_session 事件）→ DiceSession metaSet 存库；
// 下回合 buildInit 从 metaGet 读它注入 AgentInit.resume 续接。
describe("DiceSession gm-session-continuity（sdk_session 存取 + resume 注入）", () => {
  // 一回合上抛指定 sdk_session_id（+turn_end）的 fake agent——复刻 DiceGm 从 SDK system init 取到后的上抛。
  function sdkSessionAgent(id: string): Agent {
    return { async *runTurn() {
      yield { type: "sdk_session", id };
      yield { type: "turn_end" };
    } };
  }

  it("kickoff 后 metaGet('sdk_session_id') 有值（DiceGm 上抛→DiceSession 存库）", async () => {
    const db = memDb();
    const host = newDice("sc-1", { agentFactory: () => sdkSessionAgent("sdk-kick-001"), db });
    expect(host.backend.metaGet("sdk_session_id")).toBeUndefined(); // 开局前无
    await host.start();
    expect(host.backend.metaGet("sdk_session_id")).toBe("sdk-kick-001");
  });

  it("首回合 AgentInit.resume=undefined（开新 session）；第二回合注入首回合存下的 sdk_session_id", async () => {
    const db = memDb();
    const resumes: (string | undefined)[] = [];
    // 捕获每回合的 init.resume，并上抛一个 sdk_session_id 供下回合注入。
    const fac = (init: AgentInit): Agent => {
      resumes.push(init.resume);
      return { async *runTurn() { yield { type: "sdk_session", id: "sdk-turn-777" }; yield { type: "turn_end" }; } };
    };
    const host = newDice("sc-2", { agentFactory: fac, db });
    await host.handleMessage("第一回合");
    await host.handleMessage("第二回合");
    expect(resumes[0]).toBeUndefined();       // 首回合：meta 无值 → resume 省略 → SDK 开新 session
    expect(resumes[1]).toBe("sdk-turn-777");  // 第二回合：注入首回合存下的 sdk_session_id → 续接
  });

  it("重开一团（新 DiceSession/新库）不带旧 sdk_session_id → 首回合 resume=undefined（开新 session·C3）", async () => {
    let captured: string | undefined = "unset";
    const fac = (init: AgentInit): Agent => {
      captured = init.resume;
      return { async *runTurn() { yield { type: "turn_end" }; } };
    };
    // 全新 DiceSession（新内存库）—— meta 无 sdk_session_id。
    const host = newDice("sc-3-new", { agentFactory: fac, db: memDb() });
    await host.handleMessage("新局第一回合");
    expect(captured).toBeUndefined();
  });
});

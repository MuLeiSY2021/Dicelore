// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { runTurn } from "./turnLoop.js";
import { FakeDiceGm } from "./FakeDiceGm.js";
import { WsHub } from "../runtime/wsHub.js";
import type { Agent } from "../runtime/agent.js";
import { openDb, initSchema, applyMutations } from "@dicelore/backend";

function capture() {
  const msgs: any[] = [];
  const hub = new WsHub();
  hub.add("s1", { send: (d: string) => msgs.push(JSON.parse(d)), readyState: 1 });
  return { hub, msgs };
}

describe("runTurn", () => {
  it("narration(driver yield) → narration_commit；末尾发 turn_ended", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeDiceGm([{ type: "narration", text: "你推门进去。" }, { type: "turn_end" }]),
      hub, sessionId: "s1", turnId: "t1", runTurnEnd: () => ({}) }, { text: "我推门" });
    const types = msgs.map((m) => m.type);
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit"); // streamDriverTurn 共享分支(lore 需要)仍在
    expect(types.at(-1)).toBe("turn_ended");
  });

  // B4：turn_ended.seq = 全局 log event seq（非回合内计数器），对齐 §1 narrativeCursor。
  it("turn_ended.seq = 全局 log event seq（非 per-turn 计数器）", async () => {
    const db = openDb(":memory:"); initSchema(db);
    // 预置若干历史 event，模拟此前已积累的全局 seq。
    for (const c of ["旧叙事1", "旧叙事2", "旧叙事3"]) {
      db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(c);
    }
    const globalSeq = (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s;
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeDiceGm([{ type: "turn_end" }]),
      hub, sessionId: "s1", turnId: "t1", runTurnEnd: () => ({}) }, { text: "x" });
    const ended = msgs.find((m) => m.type === "turn_ended");
    expect(ended.seq).toBe(globalSeq); // 与全局口径一致，而非回合内 0/1 计数
  });

  it("turn-end 产 choices → 发 choices 消息", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeDiceGm([{ type: "turn_end" }]), hub, sessionId: "s1", turnId: "t1",
      runTurnEnd: () => ({ choices: { eventId: 9, options: [{ index: 0, label: "推门", consequence: "惊动" }] } }) }, { text: "x" });
    expect(msgs.find((m) => m.type === "choices")?.choices.eventId).toBe(9);
  });

  it("error 事件 → 发 error 消息并停止", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeDiceGm([{ type: "error", message: "boom" }]), hub, sessionId: "s1", turnId: "t1",
      runTurnEnd: () => ({}) }, { text: "x" });
    expect(msgs.find((m) => m.type === "error")?.message).toBe("boom");
    expect(msgs.find((m) => m.type === "turn_ended")).toBeUndefined();
  });

  // RT-1 中期：回合级事务。GM 跑一半（落了 log + 改了 state）后 error → 回滚到回合起点。
  // 用内联 Agent 在回合内写 DB，再 yield error，断言 log 段删净 + state 逆回起点。
  it("error 回合回滚：本回合落的 log 删净、sheet 变更逆回起点", async () => {
    const db = openDb(":memory:"); initSchema(db);
    // 回合前：HP=10 + 一条历史叙事（起点态）。
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    db.prepare("INSERT INTO log (content, kind, visible) VALUES ('回合前叙事','narrate',1)").run();
    const startSeq = (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s;

    // GM 跑一半：扣血 + 落半条叙事，然后超时 error。
    const halfThenError: Agent = {
      async *runTurn() {
        applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "7" }]);
        db.prepare("INSERT INTO log (content, kind, visible) VALUES ('半条叙事','narrate',1)").run();
        yield { type: "error", message: "gm timeout", code: "gm_timeout" } as const;
      },
    };
    const { hub, msgs } = capture();
    await runTurn({ db, driver: halfThenError, hub, sessionId: "s1", turnId: "t1", runTurnEnd: () => ({}) }, { text: "x" });

    // error 流给了前端
    expect(msgs.find((m) => m.type === "error")?.code).toBe("gm_timeout");
    // 本回合 log 段删净，回到起点 seq
    expect((db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s).toBe(startSeq);
    // HP 逆回起点 10（含本回合 mutation 事件也被删）
    expect((db.prepare("SELECT value FROM state WHERE entity='你' AND attr='HP'").get() as { value: string }).value).toBe("10");
    // 不发 turn_ended（回合作废）
    expect(msgs.find((m) => m.type === "turn_ended")).toBeUndefined();
  });

  // 正常回合不受影响：成功回合不回滚，log/state 全保留，照常发 turn_ended。
  it("正常回合不回滚：成功回合 state 变更保留、照常 turn_ended", async () => {
    const db = openDb(":memory:"); initSchema(db);
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    const okThenMutate: Agent = {
      async *runTurn() {
        applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "4" }]);
        yield { type: "turn_end" } as const;
      },
    };
    const { hub, msgs } = capture();
    await runTurn({ db, driver: okThenMutate, hub, sessionId: "s1", turnId: "t1", runTurnEnd: () => ({}) }, { text: "x" });
    // 成功回合 state 变更保留（HP=6），照常 turn_ended
    expect((db.prepare("SELECT value FROM state WHERE entity='你' AND attr='HP'").get() as { value: string }).value).toBe("6");
    expect(msgs.at(-1)?.type).toBe("turn_ended");
  });
});

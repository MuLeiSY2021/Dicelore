// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, stagePendingRoll, getPendingRoll, openSessionBackend } from "@dicelore/backend";
import { WsHub } from "../runtime/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";

describe("PlayerRollGate(单人)", () => {
  it("gate 挂起 + roll_staged 弹卡；resolveRoll 解开 promise", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const eventId = stagePendingRoll(db, { shape: "contest", spec: { context: "说服", a: { name: "张三", expr: "1d20+5" }, b: { name: "DC", expr: "15" } } });

    const g = new PlayerRollGate(openSessionBackend(db), hub, "s1");
    let resolved = false;
    const p = g.gate(eventId).then(() => { resolved = true; });
    await Promise.resolve();
    expect(sent[0].type).toBe("roll_staged");
    expect(sent[0].pendingRoll.eventId).toBe(eventId);
    expect(sent[0].pendingRoll.dc).toBe(15);
    expect(resolved).toBe(false);

    expect(g.resolveRoll(eventId)).toBe(true);
    await p;
    expect(resolved).toBe(true);
  });

  it("resolveRoll 对未知 eventId 返回 false", () => {
    const db = openDb(":memory:"); initSchema(db);
    const g = new PlayerRollGate(openSessionBackend(db), new WsHub(), "s1");
    expect(g.resolveRoll(999)).toBe(false);
  });

  // RT-FE5：明骰 outcome 的 roll_staged 投影须全量携带每档 plan+narration(不剥字段)——供前端按 spoiler 档渲染。
  it("RT-FE5：outcome roll_staged 投影 bands 完整含 plan+narration", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const eventId = stagePendingRoll(db, {
      shape: "outcome",
      spec: { context: "撬锁", die: "1d100", bands: [
        { label: "失败", min: 1, max: 50, plan: "触发警报、守卫涌来(暗值:警觉+2)", narration: "锁纹丝不动" },
        { label: "成功", min: 51, max: 100, plan: "无声打开、内室尽览", narration: "咔哒轻响" },
      ] },
    });
    const g = new PlayerRollGate(openSessionBackend(db), hub, "s1");
    g.gate(eventId);
    await Promise.resolve();
    const staged = sent.find((m) => m.type === "roll_staged");
    expect(staged).toBeTruthy();
    expect(staged.pendingRoll.bands).toEqual([
      { label: "失败", min: 1, max: 50, plan: "触发警报、守卫涌来(暗值:警觉+2)", narration: "锁纹丝不动" },
      { label: "成功", min: 51, max: 100, plan: "无声打开、内室尽览", narration: "咔哒轻响" },
    ]);
  });

  // RT-3：进程重启后,pending_roll 仍 awaiting 但内存 waiter 已丢(in-flight turn 连同 await gate 一并消失)。
  // 玩家点掷骰时若仅靠 waiter 解锁 → resolveRoll 找不到 waiter → 返回 false → 端点 409、verdict 永不落、卡死。
  // 修复后:无 waiter 时走「无 gate 立即掷」分支,直接 commit 并广播 roll_committed,玩家能正常完成一次掷骰。
  it("RT-3 重启死锁：有 awaiting pending_roll 但无内存 waiter 时,resolveRoll 立即掷并落 verdict", () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    // 构造「重启后」状态:pending_roll 已暂存(awaiting),但 gate 是新建的(waiters 为空,模拟进程重启)。
    const eventId = stagePendingRoll(db, {
      shape: "outcome",
      spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 100, plan: "门开了、内室尽览", narration: "锁咔哒一声" }] },
    });
    const g = new PlayerRollGate(openSessionBackend(db), hub, "s1");
    // 此前(红):resolveRoll 找不到 waiter → false → 端点 409 → 卡死。
    expect(g.resolveRoll(eventId)).toBe(true);
    // verdict 已落库、pending_roll 标 committed。
    const pr = getPendingRoll(db, eventId);
    expect(pr?.status).toBe("committed");
    expect(pr?.verdictSeq).not.toBeNull();
    // 广播了 roll_committed(玩家客户端能收到结果)。
    const committed = sent.find((m) => m.type === "roll_committed");
    expect(committed).toBeTruthy();
    expect(committed.eventId).toBe(pr?.verdictSeq);
    expect(committed.outcome).toBe("成功");
  });

  // 幂等:重启后玩家重复点掷骰(或 WS 重连重发)不重掷——据已落 verdict 重建,仍返回 true、不再追加 verdict。
  it("RT-3 幂等：已 committed 的 pending_roll 再次 resolveRoll 不重掷,仍 true", () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const eventId = stagePendingRoll(db, {
      shape: "outcome",
      spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 100, plan: "门开了", narration: "锁响" }] },
    });
    const g = new PlayerRollGate(openSessionBackend(db), hub, "s1");
    expect(g.resolveRoll(eventId)).toBe(true);
    const firstVerdict = getPendingRoll(db, eventId)?.verdictSeq;
    const logCountAfterFirst = (db.prepare("SELECT COUNT(*) n FROM log WHERE kind='verdict'").get() as { n: number }).n;
    // 第二次(重发)仍 true,但不追加新 verdict。
    expect(g.resolveRoll(eventId)).toBe(true);
    expect(getPendingRoll(db, eventId)?.verdictSeq).toBe(firstVerdict);
    const logCountAfterSecond = (db.prepare("SELECT COUNT(*) n FROM log WHERE kind='verdict'").get() as { n: number }).n;
    expect(logCountAfterSecond).toBe(logCountAfterFirst);
  });
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/resolver.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, openSessionBackend } from "@dicelore/backend";
import { stateSet } from "@dicelore/backend";
import { logSince } from "@dicelore/backend";
import { getPendingChoice } from "@dicelore/backend";
import { setRollGate } from "../rollGate.js";
import { makeResolverTools } from "./resolver.js";

function freshDb() { const db = openDb(":memory:"); initSchema(db); return db; }
// 内置工具 handler 经注入 SessionBackend 调存储——按 db 造工具、handler 忽略传入的 db 形参。
const byName = (db: any, n: string) => makeResolverTools(openSessionBackend(db)).find((t) => t.name === n)!;

const opts = [
  { label: "进", consequence: "遇敌" },
  { label: "退", consequence: "失机" },
];

describe("resolver handlers", () => {
  it("resolve_choice:暂存、不落 event、出参 {staged,options}", () => {
    const db = freshDb();
    const out = byName(db, "resolve_choice").handler(db, { prompt: "怎么走?", options: opts });
    expect(out).toEqual({ staged: true, options: opts });
    expect(getPendingChoice(db)?.prompt).toBe("怎么走?");
    expect(logSince(db, 0)).toHaveLength(0); // 不落 event
  });

  it("resolve_outcome_hidden:掷骰命中档位 + 落 kind=verdict event;出参 band.consequence=命中档 plan", () => {
    const db = freshDb();
    const out = byName(db, "resolve_outcome_hidden").handler(db, {
      context: "撬锁",
      die: "1d100",
      bands: [
        { label: "失败", min: 1, max: 50, plan: "触发警报、守卫涌来", narration: "锁纹丝不动" },
        { label: "成功", min: 51, max: 100, plan: "无声打开、内室尽览", narration: "咔哒一声轻响" },
      ],
    });
    expect(out.roll).toBeGreaterThanOrEqual(1);
    expect(out.roll).toBeLessThanOrEqual(100);
    expect(["失败", "成功"]).toContain(out.band.label);
    // 出参 consequence 携带命中档 plan(真相层),而非 narration。
    expect(out.band.consequence).toBe(out.band.label === "失败" ? "触发警报、守卫涌来" : "无声打开、内室尽览");
    expect(typeof out.event_id).toBe("number");
    const verdicts = logSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
    // 暗骰:结果 event 对玩家隐(visible=0);出参回显 context 供 notify 映射 hidden_roll.label。
    expect(verdicts[0].visible).toBe(0);
    expect(out.context).toBe("撬锁");
  });

  it("resolve_contest_hidden:取真值比大小 + 落 verdict;winner 正确", () => {
    const db = freshDb();
    stateSet(db, "张三", "力量", "18");
    const out = byName(db, "resolve_contest_hidden").handler(db, {
      context: "掰手腕",
      a: { name: "张三", expr: "{张三.力量}" },
      b: { name: "DC", expr: "10" },
    });
    expect(out.winner).toBe("a");
    expect(out.a.total).toBe(18);
    expect(out.b.total).toBe(10);
    expect(typeof out.event_id).toBe("number");
    const verdicts = logSince(db, 0).filter((e) => e.kind === "verdict");
    expect(verdicts).toHaveLength(1);
    // 暗骰:结果 event 对玩家隐(visible=0);出参回显 context。
    expect(verdicts[0].visible).toBe(0);
    expect(out.context).toBe("掰手腕");
  });

  it("in schema .strict():多余字段报错", () => {
    const db = freshDb();
    expect(() => byName(db, "resolve_choice").inputSchema.parse({ prompt: "p", options: opts, extra: 1 })).toThrow();
  });

  it("RT-FE5：resolve_outcome_hidden 入参 band 缺 plan/narration → 校验失败", () => {
    const db = freshDb();
    const schema = byName(db, "resolve_outcome_hidden").inputSchema;
    // 缺 plan
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20, narration: "n" }] })).toThrow();
    // 缺 narration
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20, plan: "p" }] })).toThrow();
    // 旧单一 consequence(无 plan/narration) → strict 拒 + 缺必填
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20, consequence: "x" }] })).toThrow();
    // 两字段齐 → 通过
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20, plan: "p", narration: "n" }] })).not.toThrow();
  });

  it("RT-FE5：明骰 resolve_outcome_open 入参 band 同样强制 plan/narration", () => {
    const db = freshDb();
    const schema = byName(db, "resolve_outcome_open").inputSchema;
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20 }] })).toThrow();
    expect(() => schema.parse({ context: "c", die: "1d20", bands: [{ label: "a", min: 1, max: 20, plan: "p", narration: "n" }] })).not.toThrow();
  });
});

describe("明骰 *_open", () => {
  it("resolve_outcome_open:无 gate(裸CC)→ 立即掷、回 awaiting + 落 verdict", async () => {
    const db = freshDb();
    setRollGate(undefined);
    const out = await byName(db, "resolve_outcome_open").handler(db, {
      context: "打听", die: "1d20",
      bands: [
        { label: "碰壁", min: 1, max: 10, plan: "线索断绝、对方起疑", narration: "对方摇头" },
        { label: "顺", min: 11, max: 20, plan: "拿到关键地址", narration: "对方压低声音" },
      ],
    });
    expect(out.awaiting).toBe("player_roll");
    expect(typeof out.roll).toBe("number");
    expect(out.band.label).toMatch(/碰壁|顺/);
    expect(logSince(db, 0).filter((e) => e.kind === "verdict")).toHaveLength(1);
  });

  it("resolve_contest_open:无 gate → winner 产出 + 落 verdict", async () => {
    const db = freshDb();
    setRollGate(undefined);
    const out = await byName(db, "resolve_contest_open").handler(db, {
      context: "压价", a: { name: "你", expr: "20" }, b: { name: "罗纳", expr: "1" },
    });
    expect(out.awaiting).toBe("player_roll");
    expect(out.winner).toBe("a"); // 20 vs 1
  });

  it("有 gate(组件7)→ handler await gate(eventId)后才掷", async () => {
    const db = freshDb();
    let gatedId: number | undefined;
    setRollGate(async (eventId) => { gatedId = eventId; });
    const out = await byName(db, "resolve_outcome_open").handler(db, {
      context: "x", die: "1d20", bands: [{ label: "a", min: 1, max: 20, plan: "p", narration: "n" }],
    });
    expect(gatedId).toBeGreaterThan(0); // gate 被以 eventId 调用过
    expect(out.awaiting).toBe("player_roll");
    setRollGate(undefined);
  });
});

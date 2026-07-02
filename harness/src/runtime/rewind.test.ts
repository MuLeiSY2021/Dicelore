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
import { SessionTranscript } from "./transcript.js";
import { Rewind, type RollbackHook, type RewindAnchor } from "./rewind.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "dl-rewind-"));
}

// 记录调用序的 spy hook。
function spyHook(name: string, calls: string[], opts: { throws?: boolean } = {}): RollbackHook {
  return {
    name,
    rollbackTo(anchor: RewindAnchor): void {
      calls.push(`${name}:${anchor.uuid}`);
      if (opts.throws) throw new Error(`${name} boom`);
    },
  };
}

describe("Rewind.rewindTo", () => {
  let dir: string;
  beforeEach(() => { dir = tmp(); });

  it("register 后 rewindTo(U) 先调所有 hook.rollbackTo 再 moveHead(按注册序)", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    const u1 = t.turnEnd("t1"); // 目标锚点
    t.turn({ turnId: "t2" });
    const u2 = t.turnEnd("t2"); // 当前 HEAD
    expect(t.head()).toBe(u2);

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("A", calls));
    r.register(spyHook("B", calls));

    r.rewindTo(u1);

    // 按注册序 A 再 B,都带锚点 uuid;HEAD 已移到 u1
    expect(calls).toEqual([`A:${u1}`, `B:${u1}`]);
    expect(t.head()).toBe(u1);
  });

  it("多 hook 严格按注册序调用", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turnEnd("t1");
    t.turn({ turnId: "t2" });
    t.turnEnd("t2");

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("first", calls));
    r.register(spyHook("second", calls));
    r.register(spyHook("third", calls));

    r.rewindTo(u1);
    expect(calls).toEqual([`first:${u1}`, `second:${u1}`, `third:${u1}`]);
  });

  it("hook 抛错则 head() 不变且 rewindTo 上抛", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turnEnd("t1");
    t.turn({ turnId: "t2" });
    const u2 = t.turnEnd("t2");
    expect(t.head()).toBe(u2);

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("ok", calls));
    r.register(spyHook("bad", calls, { throws: true }));
    r.register(spyHook("never", calls));

    expect(() => r.rewindTo(u1)).toThrow(/bad boom/);
    // HEAD 未动(仍在 u2),错位避免
    expect(t.head()).toBe(u2);
    // 抛错后续 hook 不再调用
    expect(calls).toEqual([`ok:${u1}`, `bad:${u1}`]);
  });

  it("rewindTo 未知 uuid 抛错且不调任何 hook", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    const u1 = t.turnEnd("t1");
    expect(t.head()).toBe(u1);

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("A", calls));

    expect(() => r.rewindTo("not-a-real-uuid")).toThrow();
    expect(calls).toEqual([]);
    expect(t.head()).toBe(u1); // 未动
  });
});

describe("Rewind.rewindLast", () => {
  let dir: string;
  beforeEach(() => { dir = tmp(); });

  it("取最近一个已完成回合末(跳过当前 HEAD 自身)并触发回退", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    const end1 = t.turnEnd("t1"); // 上一个已完成回合末 → 期望锚点
    t.turn({ turnId: "t2" });
    const end2 = t.turnEnd("t2"); // 当前 HEAD(本身也是 turn_end,应被跳过)
    expect(t.head()).toBe(end2);

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("A", calls));

    const anchor = r.rewindLast();
    expect(anchor).toEqual({ uuid: end1 });
    expect(t.head()).toBe(end1);
    expect(calls).toEqual([`A:${end1}`]);
  });

  it("HEAD 不是 turn_end 时,取活动分支上最近的 turn_end", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    const end1 = t.turnEnd("t1");
    const midTurn = t.turn({ turnId: "t2" }); // 当前 HEAD 是 turn(非 turn_end)
    expect(t.head()).toBe(midTurn);

    const r = new Rewind(t);
    const anchor = r.rewindLast();
    expect(anchor).toEqual({ uuid: end1 });
    expect(t.head()).toBe(end1);
  });

  it("空树返回 undefined 且不触发回退", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    expect(t.head()).toBeNull();

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("A", calls));

    expect(r.rewindLast()).toBeUndefined();
    expect(calls).toEqual([]);
    expect(t.head()).toBeNull();
  });

  it("活动分支无更早 turn_end(仅一个 turn_end 且为 HEAD)返回 undefined", () => {
    const t = new SessionTranscript({ sessionDir: dir, sessionId: "s1" });
    t.turn({ turnId: "t1" });
    const only = t.turnEnd("t1"); // 唯一 turn_end 且是 HEAD → 无更早的
    expect(t.head()).toBe(only);

    const calls: string[] = [];
    const r = new Rewind(t);
    r.register(spyHook("A", calls));

    expect(r.rewindLast()).toBeUndefined();
    expect(calls).toEqual([]);
    expect(t.head()).toBe(only); // 未动
  });
});

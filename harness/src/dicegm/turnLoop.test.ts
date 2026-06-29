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
import { openDb, initSchema } from "@dicelore/backend";

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
});

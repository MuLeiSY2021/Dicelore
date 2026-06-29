// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, stagePendingRoll, openSessionBackend } from "@dicelore/backend";
import { WsHub } from "../runtime/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";
import { restagePendingRolls, replayNarration } from "./recovery.js";

describe("restagePendingRolls", () => {
  it("对 awaiting 的 pending_roll 重弹 roll_staged", () => {
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    stagePendingRoll(db, { shape: "outcome", spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 60 }] } });
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const gate = new PlayerRollGate(backend, hub, "s1");
    const n = restagePendingRolls({ db, gate, hub, sessionId: "s1" });
    expect(n).toBe(1);
    expect(sent[0].type).toBe("roll_staged");
  });

  it("无 awaiting 时返回 0、不发消息", () => {
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    const hub = new WsHub();
    const gate = new PlayerRollGate(backend, hub, "s1");
    expect(restagePendingRolls({ db, gate, hub, sessionId: "s1" })).toBe(0);
  });
});

// B2：重连补叙述历史——replayNarration 把 since 之后的 narrate event 重发为 narration_commit。
describe("replayNarration", () => {
  it("重连后按 since 重发 narrate 历史为 narration_commit(seq=全局 event seq)", () => {
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    const seqs: number[] = [];
    for (const c of ["第一段", "第二段", "第三段"]) {
      const info = db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(c);
      seqs.push(Number(info.lastInsertRowid));
    }
    // 夹一条非 narrate(不应补)。
    db.prepare("INSERT INTO log (content, kind, visible) VALUES ('掷骰', 'verdict', 1)").run();
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    // 已渲染到 seqs[0]，重连补 seqs[1]、seqs[2]。
    const n = replayNarration({ backend, hub, sessionId: "s1" }, seqs[0]);
    expect(n).toBe(2);
    const narr = sent.filter((m) => m.type === "narration_commit");
    expect(narr.map((m) => m.seq)).toEqual([seqs[1], seqs[2]]);
    expect(narr.map((m) => m.text)).toEqual(["第二段", "第三段"]);
  });

  it("since 已到末尾时补 0 条", () => {
    const db = openDb(":memory:"); initSchema(db);
    const backend = openSessionBackend(db);
    const info = db.prepare("INSERT INTO log (content, kind, visible) VALUES ('唯一一段','narrate',1)").run();
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    expect(replayNarration({ backend, hub, sessionId: "s1" }, Number(info.lastInsertRowid))).toBe(0);
    expect(sent.length).toBe(0);
  });
});

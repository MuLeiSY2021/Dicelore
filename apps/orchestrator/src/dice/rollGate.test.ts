// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, stagePendingRoll } from "@dicelore/core";
import { WsHub } from "../pkg/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";

describe("PlayerRollGate(单人)", () => {
  it("gate 挂起 + roll_staged 弹卡；resolveRoll 解开 promise", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const eventId = stagePendingRoll(db, { shape: "contest", spec: { context: "说服", a: { name: "张三", expr: "1d20+5" }, b: { name: "DC", expr: "15" } } });

    const g = new PlayerRollGate(db, hub, "s1");
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
    const g = new PlayerRollGate(db, new WsHub(), "s1");
    expect(g.resolveRoll(999)).toBe(false);
  });
});

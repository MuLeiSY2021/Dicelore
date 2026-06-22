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
import { WsHub } from "./pkg/wsHub.js";
import { PlayerRollGate } from "./dice/rollGate.js";
import { restagePendingRolls } from "./recovery.js";

describe("restagePendingRolls", () => {
  it("对 awaiting 的 pending_roll 重弹 roll_staged", () => {
    const db = openDb(":memory:"); initSchema(db);
    stagePendingRoll(db, { shape: "outcome", spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 60 }] } });
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const gate = new PlayerRollGate(db, hub, "s1");
    const n = restagePendingRolls({ db, gate, hub, sessionId: "s1" });
    expect(n).toBe(1);
    expect(sent[0].type).toBe("roll_staged");
  });

  it("无 awaiting 时返回 0、不发消息", () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const gate = new PlayerRollGate(db, hub, "s1");
    expect(restagePendingRolls({ db, gate, hub, sessionId: "s1" })).toBe(0);
  });
});

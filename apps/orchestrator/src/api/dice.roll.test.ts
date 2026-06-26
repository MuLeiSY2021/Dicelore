// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, stagePendingRoll, getPendingRoll, type DB } from "@dicelore/core";
import { createLiveApp } from "./dice.js";
import { removeHost } from "../dice/registry.js";
import { FakeDiceGm } from "../dice/FakeDiceGm.js";

// RT-3：进程重启后点掷骰不再挂死/误 409——POST /roll 端点级回归。
describe("POST /sessions/:id/roll(RT-3 重启恢复)", () => {
  it("重启后(registry 空、内存无 waiter)有 awaiting pending_roll，点掷骰立即掷并落 verdict → 202", async () => {
    const id = "roll-restart-1";
    removeHost(id); // 模拟进程重启:内存 registry 无此 host(且无内存 waiter)。
    const db: DB = openDb(":memory:"); initSchema(db);
    // 库里仍有重启前暂存的 awaiting pending_roll(in-flight turn 已随重启丢失)。
    const eventId = stagePendingRoll(db, {
      shape: "outcome",
      spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 100, consequence: "门开了" }] },
    });
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });

    const res = await app.request(`/sessions/${id}/roll`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    // 此前(死锁):getHost 找不到 host → 409;即便建了 host,resolveRoll 无 waiter 也回 false → 409。
    expect(res.status).toBe(202);
    const pr = getPendingRoll(db, eventId);
    expect(pr?.status).toBe("committed");
    expect(pr?.verdictSeq).not.toBeNull();
    removeHost(id);
  });

  it("库里确无此 eventId 的 pending_roll → 409 no_pending_roll(语义保留)", async () => {
    const id = "roll-restart-2";
    removeHost(id);
    const db: DB = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });
    const res = await app.request(`/sessions/${id}/roll`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: 999 }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("no_pending_roll");
    removeHost(id);
  });
});

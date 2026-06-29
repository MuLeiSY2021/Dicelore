// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, listSnapshots, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { removeHost } from "@dicelore/harness";
import { FakeDiceGm } from "@dicelore/harness";

// SNAP-1 读档端点（ADR-0017 v1：自动恢复最近快照，存档/读档语义）。
describe("POST /sessions/:id/rewind（SNAP-1 读档）", () => {
  it("跑过一回合后 rewind → 202 {snapshotId}，状态整表覆写回快照态", async () => {
    const id = "rewind-1";
    removeHost(id);
    const db: DB = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({
      agentFactory: () => new FakeDiceGm([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]),
      openSession: () => db,
    });

    // 跑一回合（turnEnd 自动 checkpoint，存 HP=10）。
    db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP','10')").run();
    const mres = await app.request(`/sessions/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "推门" }),
    });
    expect(mres.status).toBe(202);
    expect(listSnapshots(db)).toHaveLength(1);

    // 回合后改状态 → rewind 应抹掉。
    db.prepare("UPDATE state SET value='3' WHERE entity='你' AND attr='HP'").run();
    const res = await app.request(`/sessions/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(typeof body.snapshotId).toBe("number");
    const hp = (db.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v;
    expect(hp).toBe("10");
    removeHost(id);
  });

  it("无快照（未跑过回合）→ 409 no_snapshot", async () => {
    const id = "rewind-2";
    removeHost(id);
    const db: DB = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });
    const res = await app.request(`/sessions/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("no_snapshot");
    removeHost(id);
  });
});

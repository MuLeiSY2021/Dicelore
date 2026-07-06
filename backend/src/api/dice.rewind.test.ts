// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema, listSnapshots, checkpoint, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { removeHost, sessionDir, SessionTranscript } from "@dicelore/harness";
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

// TR3 additive：POST /rewind body {toUuid} —— 按 transcript 节点 uuid 回退。
describe("POST /sessions/:id/rewind（TR3：带 toUuid 锤到 transcript uuid）", () => {
  // 组合根注入 sessionsDir 后 host.openTranscript 落 sessionDir(sessionsDir,'dice',id)；
  // 测试用同一路径构造 SessionTranscript 预铸节点 + 直接 checkpoint(db,{anchorUuid}) 挂快照。
  function setup(id: string): { db: DB; sessionsDir: string; app: ReturnType<typeof createLiveApp>; t: SessionTranscript } {
    removeHost(id);
    const db: DB = openDb(":memory:"); initSchema(db);
    const sessionsDir = mkdtempSync(join(tmpdir(), "tr3-rewind-"));
    const app = createLiveApp({
      agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]),
      openSession: () => db,
      sessionsDir,
    });
    const t = new SessionTranscript({ sessionDir: sessionDir(sessionsDir, "dice", id), sessionId: id });
    return { db, sessionsDir, app, t };
  }

  it("带 toUuid → 202 {uuid}，领域态整表覆写回锚点态 + transcript HEAD 挪到该 uuid", async () => {
    const id = "rewind-uuid-1";
    const { db, sessionsDir, app, t } = setup(id);

    // 预铸节点 A（锚点）+ 挂一份 HP=10 的 db 快照。
    db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP','10')").run();
    const uuidA = t.turnEnd("t1");
    checkpoint(db, { turnSeq: 1, anchorUuid: uuidA });

    // 继续推进到节点 B + 改状态（回退应抹掉）。
    t.turnEnd("t2");
    db.prepare("UPDATE state SET value='3' WHERE entity='你' AND attr='HP'").run();
    db.prepare("INSERT INTO state (entity, attr, value) VALUES ('你','金币','99')").run();

    const res = await app.request(`/sessions/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toUuid: uuidA }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()).uuid).toBe(uuidA);

    const hp = (db.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v;
    expect(hp).toBe("10"); // 回锚点态
    expect(db.prepare("SELECT value FROM state WHERE entity='你' AND attr='金币'").get()).toBeUndefined(); // 锚点后新增被抹
    // transcript HEAD 已挪回锚点节点（新开一个视图读盘上的 HEAD）。
    const head = new SessionTranscript({ sessionDir: sessionDir(sessionsDir, "dice", id), sessionId: id }).head();
    expect(head).toBe(uuidA);
    removeHost(id);
  });

  it("toUuid 不在 transcript 树内 → 404 unknown_anchor", async () => {
    const id = "rewind-uuid-2";
    const { app, t } = setup(id);
    t.turnEnd("t1"); // 树内有节点，但请求一个不存在的 uuid
    const res = await app.request(`/sessions/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toUuid: "not-in-tree" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("unknown_anchor");
    removeHost(id);
  });

  it("toUuid 在树内但无对应 db 快照 → 409 no_snapshot_for_anchor", async () => {
    const id = "rewind-uuid-3";
    const { app, t } = setup(id);
    const uuid = t.turnEnd("t1"); // 节点在树内，但未 checkpoint 该锚点
    const res = await app.request(`/sessions/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toUuid: uuid }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("no_snapshot_for_anchor");
    removeHost(id);
  });
});

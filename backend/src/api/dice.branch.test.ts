// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// debrief-and-branch 验收：分支三端点 + rewind 覆盖当前分支 + 战后复盘态。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, checkpoint, branchDbKey, type DB } from "@dicelore/backend";
import { createLiveApp } from "./dice.js";
import { FakeDiceGm, removeHost } from "@dicelore/harness";

function memSessions(): { open: (id: string) => DB; dbs: Map<string, DB> } {
  const dbs = new Map<string, DB>();
  const open = (id: string): DB => { let d = dbs.get(id); if (!d) { d = openDb(":memory:"); initSchema(d); dbs.set(id, d); } return d; };
  return { open, dbs };
}

// 灌 n 条事件 + 在 snapshotAt 的 seq 落快照（模拟已跑若干回合）。
function seed(db: DB, n: number, snapshotAt: number[]): void {
  for (let i = 1; i <= n; i++) {
    db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(`e${i}`);
    if (snapshotAt.includes(i)) checkpoint(db, { turnSeq: i });
  }
}
const maxSeq = (db: DB) => (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null }).s ?? 0;

describe("会话分支端点（debrief-and-branch §二）", () => {
  it("当前分支 seq=10 → POST /branches {fromSeq:5} → 201 新支 isCurrent；GET 列两支；新支 drive 不影响旧支", async () => {
    const id = "branch-1"; removeHost(id);
    const { open } = memSessions();
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "narration", text: "续玩。" }, { type: "turn_end" }]), openSession: open });
    seed(open(id), 10, [5, 10]);

    const cr = await app.request(`/sessions/dicegm/${id}/branches`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromSeq: 5 }),
    });
    expect(cr.status).toBe(201);
    const cbody = (await cr.json()) as { branchId: string; fromSeq: number; isCurrent: boolean };
    expect(cbody.fromSeq).toBe(5);
    expect(cbody.isCurrent).toBe(true);

    const lr = await app.request(`/sessions/dicegm/${id}/branches`);
    const list = (await lr.json()) as { currentBranchId: string; branches: { branchId: string; seq: number; isCurrent: boolean }[] };
    expect(list.branches).toHaveLength(2);
    expect(list.currentBranchId).toBe(cbody.branchId);
    expect(list.branches.find((b) => b.branchId === "main")!.seq).toBe(10);
    expect(list.branches.find((b) => b.branchId === cbody.branchId)!.seq).toBe(5);

    // 新分支现为当前分支 → drive 一回合被本分支库接住（host 已重绑到新分支库）。
    const mr = await app.request(`/sessions/dicegm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "继续" }),
    });
    expect(mr.status).toBe(202);
    // 存储独立性：直接在新分支库追加事件（模拟一次叙事落库）不影响旧分支 main。
    const newDb = open(branchDbKey(id, cbody.branchId));
    newDb.prepare("INSERT INTO log (content, kind, visible) VALUES ('新分支事件','narrate',1)").run();
    expect(maxSeq(newDb)).toBe(6); // 从 fromSeq=5 连续编号
    // 旧分支 main 不受影响，仍 seq=10。
    expect(maxSeq(open(id))).toBe(10);
    removeHost(id);
  });

  it("checkout 回旧分支 → 200 {branchId, presentation}，presentation.seq 反映该分支", async () => {
    const id = "branch-2"; removeHost(id);
    const { open } = memSessions();
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: open });
    seed(open(id), 10, [10]);

    const cr = await app.request(`/sessions/dicegm/${id}/branches`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromSeq: 3 }),
    });
    const { branchId } = (await cr.json()) as { branchId: string };

    // checkout 回 main
    const co = await app.request(`/sessions/dicegm/${id}/branches/main/checkout`, { method: "POST" });
    expect(co.status).toBe(200);
    const cobody = (await co.json()) as { branchId: string; presentation: { seq: number } };
    expect(cobody.branchId).toBe("main");
    expect(cobody.presentation.seq).toBe(10);

    // checkout 未知分支 → 404
    const bad = await app.request(`/sessions/dicegm/${id}/branches/nope/checkout`, { method: "POST" });
    expect(bad.status).toBe(404);
    expect((await bad.json()).code).toBe("unknown_branch");
    // 且 branchId 变量已用于覆盖：新分支存在
    expect(typeof branchId).toBe("string");
    removeHost(id);
  });
});

describe("rewind 覆盖当前分支（debrief-and-branch §二.4）", () => {
  it("当前分支 seq=10 → POST /rewind {toSeq:5} → 202 {seq:5}，其后事件丢弃", async () => {
    const id = "rewind-seq-1"; removeHost(id);
    const db = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });
    seed(db, 10, [5, 10]);
    // 快照在 seq5 时 HP=?—在 seed 后单独设 HP 并再落 seq5 前... 简化：直接验 log 截断。
    const res = await app.request(`/sessions/dicegm/${id}/rewind`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toSeq: 5 }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()).seq).toBe(5);
    expect(maxSeq(db)).toBe(5);
    removeHost(id);
  });
});

describe("战后复盘态（debrief-and-branch §一）", () => {
  it("game_end(ended 已置)→ GET /:id status=debrief 且 ended=true（不归档）", async () => {
    const id = "debrief-1"; removeHost(id);
    const db = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "turn_end" }]), openSession: () => db });
    db.prepare("INSERT INTO session_meta (key,value) VALUES ('ended', ?)").run(JSON.stringify({ reason: "团灭", seq: 3 }));

    const res = await app.request(`/sessions/dicegm/${id}`);
    expect(res.status).toBe(200);
    const info = (await res.json()) as { status: string; ended: boolean };
    expect(info.status).toBe("debrief");
    expect(info.ended).toBe(true);
    removeHost(id);
  });

  it("复盘态下 POST /messages 仍 202 接受", async () => {
    const id = "debrief-2"; removeHost(id);
    const db = openDb(":memory:"); initSchema(db);
    const app = createLiveApp({ agentFactory: () => new FakeDiceGm([{ type: "narration", text: "复盘中。" }, { type: "turn_end" }]), openSession: () => db });
    db.prepare("INSERT INTO session_meta (key,value) VALUES ('ended', ?)").run(JSON.stringify({ reason: "胜利", seq: 2 }));
    const res = await app.request(`/sessions/dicegm/${id}/messages`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "为什么会赢？" }),
    });
    expect(res.status).toBe(202);
    removeHost(id);
  });
});

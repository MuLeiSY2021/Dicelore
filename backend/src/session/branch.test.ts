// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// debrief-and-branch §二：分支模型单测（复制/截断原语 + 列/切/建分支）。

import { describe, it, expect } from "vitest";
import { openDb, initSchema, checkpoint, type DB } from "@dicelore/backend";
import {
  MAIN_BRANCH, branchDbKey, currentBranch,
  listBranches, checkoutBranch, createBranch, cloneInto, truncateToSeq,
  type OpenBranchDb,
} from "./branch.js";

function mem(): DB { const d = openDb(":memory:"); initSchema(d); return d; }

// 一个按 key 复用 db 的会话库工厂（模拟组合根 openSession(branchDbKey(...))）。
function branchStore(): { open: OpenBranchDb; dbs: Map<string, DB> } {
  const dbs = new Map<string, DB>();
  const open: OpenBranchDb = (sessionId, branchId) => {
    const key = branchDbKey(sessionId, branchId);
    let d = dbs.get(key);
    if (!d) { d = mem(); dbs.set(key, d); }
    return d;
  };
  return { open, dbs };
}

// 灌 n 条 narrate 事件（seq 1..n），并按需在若干 seq 落快照。
function seedLog(db: DB, n: number, snapshotAt: number[] = []): void {
  for (let i = 1; i <= n; i++) {
    db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(`事件${i}`);
    if (snapshotAt.includes(i)) checkpoint(db, { turnSeq: i });
  }
}

describe("branchDbKey / currentBranch", () => {
  it("main 分支键=sessionId（向后兼容），其他嵌 session 目录", () => {
    expect(branchDbKey("s1", MAIN_BRANCH)).toBe("s1");
    expect(branchDbKey("s1", "b2")).toBe("s1/branches/b2");
  });
  it("未置位时当前分支默认 main", () => {
    expect(currentBranch(mem())).toBe(MAIN_BRANCH);
  });
});

describe("cloneInto", () => {
  it("整库复制：log 全行 + 事件内容随之复制", () => {
    const src = mem(); const dest = mem();
    seedLog(src, 3);
    src.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP','10')").run();
    cloneInto(src, dest);
    expect((dest.prepare("SELECT COUNT(*) n FROM log").get() as { n: number }).n).toBe(3);
    expect((dest.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v).toBe("10");
    // seq 保号
    expect((dest.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s).toBe(3);
  });
});

describe("truncateToSeq", () => {
  it("截断到 toSeq：其后 log 丢弃、领域态复位到 ≤toSeq 的快照、清 ended", () => {
    const db = mem();
    // seq1..5 各落快照；状态在每步演进。
    for (let i = 1; i <= 5; i++) {
      db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(`e${i}`);
      db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES ('你','HP',?)").run(String(10 + i));
      checkpoint(db, { turnSeq: i });
    }
    db.prepare("INSERT INTO session_meta (key,value) VALUES ('ended','x')").run();
    truncateToSeq(db, 3);
    expect((db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null }).s).toBe(3);
    expect((db.prepare("SELECT value v FROM state WHERE entity='你' AND attr='HP'").get() as { v: string }).v).toBe("13");
    expect(db.prepare("SELECT value FROM session_meta WHERE key='ended'").get()).toBeUndefined();
  });
});

describe("createBranch / listBranches / checkoutBranch", () => {
  it("从 fromSeq 建分支 → 新分支自动成当前 + 列出两支 + 新分支 drive 不影响旧分支", () => {
    const { open } = branchStore();
    const sessionId = "sess";
    const mainDb = open(sessionId, MAIN_BRANCH);
    seedLog(mainDb, 10, [5, 10]); // main seq=10，快照在 5/10

    const res = createBranch(mainDb, open, sessionId, { fromSeq: 5 });
    expect(res.isCurrent).toBe(true);
    expect(res.fromSeq).toBe(5);
    expect(currentBranch(mainDb)).toBe(res.branchId);

    // 列两支：main + 新分支；新分支 seq=5，main 仍 10。
    const list = listBranches(mainDb, open, sessionId);
    expect(list.currentBranchId).toBe(res.branchId);
    expect(list.branches).toHaveLength(2);
    const main = list.branches.find((b) => b.branchId === MAIN_BRANCH)!;
    const nb = list.branches.find((b) => b.branchId === res.branchId)!;
    expect(main.seq).toBe(10);
    expect(nb.seq).toBe(5);
    expect(nb.isCurrent).toBe(true);

    // 在新分支 drive 一步 → 不影响 main。
    const nbDb = open(sessionId, res.branchId);
    nbDb.prepare("INSERT INTO log (content, kind, visible) VALUES ('新分支事件','narrate',1)").run();
    expect((nbDb.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s).toBe(6);
    expect((mainDb.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s).toBe(10);

    // checkout 回 main → 当前分支置回 main，main seq 仍 10。
    expect(checkoutBranch(mainDb, MAIN_BRANCH)).toBe(true);
    expect(currentBranch(mainDb)).toBe(MAIN_BRANCH);
  });

  it("fromSeq 省略 = 复制到当前 seq（不截断）", () => {
    const { open } = branchStore();
    const mainDb = open("s", MAIN_BRANCH);
    seedLog(mainDb, 4, [4]);
    const res = createBranch(mainDb, open, "s", {});
    expect(res.fromSeq).toBe(4);
    expect((open("s", res.branchId).prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s).toBe(4);
  });

  it("checkout 未知分支 → false", () => {
    const { open } = branchStore();
    const mainDb = open("s", MAIN_BRANCH);
    expect(checkoutBranch(mainDb, "nope")).toBe(false);
  });
});

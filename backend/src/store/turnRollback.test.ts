// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema, type DB } from "./db.js";
import { turnStartSeq, rollbackAfterSeq } from "./turnRollback.js";
import { applyMutations } from "./sheet/mutate.js";
import { logAppend, logRecall } from "./event/record.js";

function freshDb(): DB {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}
function logCount(db: DB): number {
  return (db.prepare("SELECT COUNT(*) c FROM log").get() as { c: number }).c;
}
function maxSeq(db: DB): number {
  return (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null }).s ?? 0;
}
function sheet(db: DB, entity: string, attr: string): string | undefined {
  return (db.prepare("SELECT value FROM state WHERE entity=? AND attr=?").get(entity, attr) as { value: string } | undefined)?.value;
}
function appendNarrate(db: DB, content: string): void {
  db.prepare("INSERT INTO log (content, kind, visible) VALUES (?, 'narrate', 1)").run(content);
}

describe("turnStartSeq：回合起点 = 当前全局 log MAX(seq)", () => {
  it("空 log → 0", () => {
    const db = freshDb();
    expect(turnStartSeq(db)).toBe(0);
  });
  it("有历史 event → 返回最大 seq（与 turnLoop turn_ended.seq 同口径）", () => {
    const db = freshDb();
    appendNarrate(db, "旧1");
    appendNarrate(db, "旧2");
    expect(turnStartSeq(db)).toBe(maxSeq(db));
    expect(turnStartSeq(db)).toBe(2);
  });
});

describe("rollbackAfterSeq：删本回合 log 段 + 逆 state 变更", () => {
  it("删净 seq>start 的 log，保留起点及之前", () => {
    const db = freshDb();
    appendNarrate(db, "回合前1");
    appendNarrate(db, "回合前2");
    const start = turnStartSeq(db); // 2
    // 本回合内积累若干 event
    appendNarrate(db, "本回合A");
    appendNarrate(db, "本回合B");
    expect(logCount(db)).toBe(4);

    const report = rollbackAfterSeq(db, start);
    expect(logCount(db)).toBe(2); // 只剩起点前的两条
    expect(maxSeq(db)).toBe(2);
    expect(report.deletedLogCount).toBe(2);
  });

  it("正常回合不受影响：start 取在所有 event 之后 → rollback 删 0 条", () => {
    const db = freshDb();
    appendNarrate(db, "e1");
    appendNarrate(db, "e2");
    const start = turnStartSeq(db);
    const report = rollbackAfterSeq(db, start);
    expect(logCount(db)).toBe(2);
    expect(report.deletedLogCount).toBe(0);
  });

  it("逆本回合 sheet 变更：state 回到起点值（mutation event 含 old，可精确逆）", () => {
    const db = freshDb();
    // 回合前：HP=10
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    const start = turnStartSeq(db);
    expect(sheet(db, "你", "HP")).toBe("10");

    // 本回合 GM 跑了一半：HP -7，再新增「金币」属性
    applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "7" }]);
    applyMutations(db, "你", [{ attr: "金币", op: "=", expr: "99" }]);
    expect(sheet(db, "你", "HP")).toBe("3");
    expect(sheet(db, "你", "金币")).toBe("99");

    rollbackAfterSeq(db, start);
    // HP 逆回起点 10；金币（起点不存在 → old=null）整行删除
    expect(sheet(db, "你", "HP")).toBe("10");
    expect(sheet(db, "你", "金币")).toBeUndefined();
    // 本回合的 mutation log 段删净
    expect(maxSeq(db)).toBe(start);
  });

  it("多步链式变更按 seq 逆序回放，回到起点（HP 10→8→5→2 全部撤回）", () => {
    const db = freshDb();
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    const start = turnStartSeq(db);
    applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "2" }]); // 8
    applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "3" }]); // 5
    applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "3" }]); // 2
    expect(sheet(db, "你", "HP")).toBe("2");

    const report = rollbackAfterSeq(db, start);
    expect(sheet(db, "你", "HP")).toBe("10"); // 逆序回放 old：2←5←8←10
    expect(report.stateReverted).toBeGreaterThan(0);
  });

  it("report.residue 记录无法精确逆的副作用表（watcher/pending_roll 等非 state/log）", () => {
    const db = freshDb();
    const start = turnStartSeq(db);
    // 本回合落了一条 pending_roll（GM 跑一半挂起的明骰）—— rollback 不碰它，应进 residue
    db.prepare("INSERT INTO pending_roll (shape, spec_json) VALUES ('outcome', '{}')").run();
    appendNarrate(db, "半条叙述");
    const report = rollbackAfterSeq(db, start);
    expect(report.residue.length).toBeGreaterThan(0);
    expect(report.residue.some((r) => r.includes("pending_roll"))).toBe(true);
  });

  it("整事务原子性：rollback 在单事务内完成（无半态）", () => {
    const db = freshDb();
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    const start = turnStartSeq(db);
    applyMutations(db, "你", [{ attr: "HP", op: "-", expr: "5" }]);
    // 不抛、不留半态
    expect(() => rollbackAfterSeq(db, start)).not.toThrow();
    expect(sheet(db, "你", "HP")).toBe("10");
    expect(maxSeq(db)).toBe(start);
  });
});

describe("CONCERN-1：回滚同步清 log_fts 孤儿索引（FTS 一致性）", () => {
  function ftsRowCount(db: DB): number {
    return (db.prepare("SELECT COUNT(*) c FROM log_fts").get() as { c: number }).c;
  }

  it("回合内 narrate 写 log_fts 后回滚 → logRecall/FTS 搜不到本回合内容（孤儿已清）", () => {
    const db = freshDb();
    // 回合前的内容：保留，回滚后仍应可搜
    logAppend(db, { kind: "narrate", content: "回合前的旧叙述提到了古老的灯塔" });
    const start = turnStartSeq(db);
    expect(logRecall(db, "灯塔").length).toBe(1);
    const ftsBefore = ftsRowCount(db);

    // 本回合 GM 落了若干 narrate（content 非空 → 写入 log_fts），随后回滚
    logAppend(db, { kind: "narrate", content: "本回合一条会被回滚的独特咒语阿巴拉卡达布拉" });
    logAppend(db, { kind: "narrate", content: "本回合另一条神秘符文齐格弗里德" });
    expect(logRecall(db, "阿巴拉卡达布拉").length).toBe(1); // 回滚前搜得到
    expect(ftsRowCount(db)).toBe(ftsBefore + 2);

    rollbackAfterSeq(db, start);

    // 回滚后：本回合内容的 FTS 索引已清，搜不到
    expect(logRecall(db, "阿巴拉卡达布拉")).toEqual([]);
    expect(logRecall(db, "齐格弗里德")).toEqual([]);
    // log_fts 不残留孤儿行，回到起点态
    expect(ftsRowCount(db)).toBe(ftsBefore);
    // 起点前的内容仍可搜（未误删）
    expect(logRecall(db, "灯塔").length).toBe(1);
  });

  it("空 content 的 event 不写 log_fts，回滚也不报错", () => {
    const db = freshDb();
    const start = turnStartSeq(db);
    logAppend(db, { kind: "mutation", data_json: { entity: "你", applied: [] } }); // 无 content
    expect(() => rollbackAfterSeq(db, start)).not.toThrow();
    expect((db.prepare("SELECT COUNT(*) c FROM log_fts").get() as { c: number }).c).toBe(0);
  });
});

describe("CONCERN-3：单 event 内同一 attr 重复变更，逆放回最早（首项）old", () => {
  it("一次 applyMutations 多步同 attr（HP 10→8→3）回滚后回到起点 10，而非末项 old", () => {
    const db = freshDb();
    applyMutations(db, "你", [{ attr: "HP", op: "=", expr: "10" }]);
    const start = turnStartSeq(db);
    // 同一 event 的 applied[] 含同一 attr 多次：HP -2(10→8) 再 -5(8→3)
    applyMutations(db, "你", [
      { attr: "HP", op: "-", expr: "2" },
      { attr: "HP", op: "-", expr: "5" },
    ]);
    expect(sheet(db, "你", "HP")).toBe("3");

    // 该 event 的 applied[] = [{attr:HP, old:"10"}, {attr:HP, old:"8"}]
    // 正序回放会落到末项 old=8（错）；倒序回放落到首项 old=10（对，起点值）
    const report = rollbackAfterSeq(db, start);
    expect(sheet(db, "你", "HP")).toBe("10");
    expect(report.stateReverted).toBeGreaterThan(0);
  });
});

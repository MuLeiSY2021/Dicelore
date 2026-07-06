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
import {
  checkpoint,
  restore,
  restoreToAnchor,
  latestSnapshot,
  listSnapshots,
  registerSnapshotParticipant,
  defaultParticipants,
  tableParticipant,
} from "./snapshot.js";
import { loreUpsert, loreGet, loreSearch } from "./world/world.js";

function freshDb(): DB {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

// sheet 域 = state 表;world.runtime = lore 表;watcher = watcher 表(默认注册的三域)。
function setSheet(db: DB, entity: string, attr: string, value: string) {
  db.prepare("INSERT OR REPLACE INTO state (entity, attr, value) VALUES (?, ?, ?)").run(entity, attr, value);
}
function getSheet(db: DB, entity: string, attr: string): string | undefined {
  return (db.prepare("SELECT value FROM state WHERE entity=? AND attr=?").get(entity, attr) as { value: string } | undefined)?.value;
}
function setWatcher(db: DB, condition: string, payload: string, armed: number) {
  db.prepare("INSERT INTO watcher (condition, payload, armed) VALUES (?, ?, ?)").run(condition, payload, armed);
}
function watcherRows(db: DB) {
  return db.prepare("SELECT condition, armed FROM watcher ORDER BY id").all() as { condition: string; armed: number }[];
}

describe("snapshot 原语：checkpoint / restore（默认三域 sheet/world/watcher）", () => {
  it("checkpoint 后改状态 → restore 回到快照态（sheet 整表覆写）", () => {
    const db = freshDb();
    setSheet(db, "你", "HP", "10");
    const snapId = checkpoint(db, { turnSeq: 1 });

    // 回合后状态变更
    setSheet(db, "你", "HP", "3");
    setSheet(db, "你", "金币", "99");
    expect(getSheet(db, "你", "HP")).toBe("3");

    restore(db, snapId);
    expect(getSheet(db, "你", "HP")).toBe("10"); // 回到快照值
    expect(getSheet(db, "你", "金币")).toBeUndefined(); // 快照后新增的行被整表覆写抹掉
  });

  it("restore watcher 运行时态（armed/fired）整体覆写，不逆级联", () => {
    const db = freshDb();
    setWatcher(db, "HP<=0", "你倒下了", 1);
    const snapId = checkpoint(db, { turnSeq: 1 });

    // 触发后 disarm + 又新增一个 watcher
    db.prepare("UPDATE watcher SET armed=0").run();
    setWatcher(db, "金币>=100", "暴富", 1);
    expect(watcherRows(db)).toHaveLength(2);

    restore(db, snapId);
    const rows = watcherRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ condition: "HP<=0", armed: 1 }); // armed 回到快照态
  });

  it("restore world.runtime（lore）整表覆写 + 重建 FTS（restore 出的态可被检索）", () => {
    const db = freshDb();
    loreUpsert(db, { name: "古井", content: "村口有一口枯井" });
    const snapId = checkpoint(db, { turnSeq: 1 });

    // AI 现编：改写古井 + 新增一条
    loreUpsert(db, { name: "古井", content: "井底藏着宝箱" });
    loreUpsert(db, { name: "铁门", content: "锈蚀的铁门" });

    restore(db, snapId);
    expect(loreGet(db, "古井")?.content).toBe("村口有一口枯井"); // 内容回滚
    expect(loreGet(db, "铁门")).toBeUndefined(); // 新增行被抹
    // FTS 与表一致：搜旧内容命中、搜新内容不命中。
    expect(loreSearch(db, "枯井", 10).some((h) => h.name === "古井")).toBe(true);
    expect(loreSearch(db, "宝箱", 10)).toHaveLength(0);
    expect(loreSearch(db, "铁门", 10)).toHaveLength(0);
  });

  it("rule 不注册为 participant → restore 永不碰 rule（带外变更自动留存）", () => {
    const db = freshDb();
    db.prepare("INSERT INTO rule (name, content, version) VALUES (?, ?, ?)").run("掷骰规则", "原始", 1);
    const snapId = checkpoint(db, { turnSeq: 1 });

    // 快照后热更 rule（带外）
    db.prepare("UPDATE rule SET content='热更版', version=2 WHERE name='掷骰规则'").run();

    restore(db, snapId);
    const r = db.prepare("SELECT content, version FROM rule WHERE name='掷骰规则'").get() as { content: string; version: number };
    expect(r.content).toBe("热更版"); // 未被回滚
    expect(r.version).toBe(2);
  });

  it("restore 回滚叙事脚手架运行期态（front.status / 新增 plotline / pool AI 行）", () => {
    const db = freshDb();
    db.prepare("INSERT INTO front (id, name, stakes, status) VALUES ('f1', '黑塔', '世界毁灭', 'active')").run();
    const snapId = checkpoint(db, { turnSeq: 1 });

    // 回合中 AI 叙事工具改 front 状态、新增 plotline、AI 现编 pool 行
    db.prepare("UPDATE front SET status='resolved' WHERE id='f1'").run();
    db.prepare("INSERT INTO plotline (id, title, status) VALUES ('p1', '复仇', 'open')").run();
    db.prepare("INSERT INTO pool (pool, row_json, source) VALUES ('drop', '{\"n\":\"剑\"}', 'ai')").run();
    expect((db.prepare("SELECT status FROM front WHERE id='f1'").get() as { status: string }).status).toBe("resolved");

    restore(db, snapId);
    expect((db.prepare("SELECT status FROM front WHERE id='f1'").get() as { status: string }).status).toBe("active"); // 回滚
    expect(db.prepare("SELECT id FROM plotline WHERE id='p1'").get()).toBeUndefined(); // 新增被抹
    expect(db.prepare("SELECT 1 FROM pool WHERE source='ai'").get()).toBeUndefined(); // AI 现编 pool 行被抹
  });

  it("defaultParticipants 含推进态各域（sheet/world/watcher + front/plotline/foreshadow/pool，rule 不在内）", () => {
    const names = defaultParticipants().map((p) => p.name).sort();
    expect(names).toEqual(["foreshadow", "front", "plotline", "pool", "sheet", "watcher", "world"].sort());
  });
});

describe("snapshot 表 + 查询", () => {
  it("checkpoint 落一行，记 turn_start_seq/turn_end_seq + created_at + parent_id", () => {
    const db = freshDb();
    const s1 = checkpoint(db, { turnSeq: 5 });
    const s2 = checkpoint(db, { turnSeq: 8 });
    const all = listSnapshots(db);
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(s1);
    expect(all[1].id).toBe(s2);
    expect(all[1].turnEndSeq).toBe(8);
    expect(all[1].parentId).toBe(s1); // parent 链接前一个快照
    expect(typeof all[1].createdAt).toBe("string");
  });

  it("latestSnapshot 取最近一份；空库 → undefined", () => {
    const db = freshDb();
    expect(latestSnapshot(db)).toBeUndefined();
    checkpoint(db, { turnSeq: 1 });
    const s2 = checkpoint(db, { turnSeq: 2 });
    expect(latestSnapshot(db)?.id).toBe(s2);
  });

  it("restore 对不存在的 snapshotId 抛错", () => {
    const db = freshDb();
    expect(() => restore(db, 999)).toThrow();
  });
});

describe("SnapshotParticipant 注册表（IoC）", () => {
  it("自定义域注册即入快照、restore 覆写——core 零编译期依赖具体域", () => {
    const db = freshDb();
    db.exec("CREATE TABLE custom_domain (k TEXT PRIMARY KEY, v TEXT)");
    db.prepare("INSERT INTO custom_domain VALUES ('a', '1')").run();

    const parts = [...defaultParticipants(), tableParticipant("custom", "custom_domain")];
    const snapId = checkpoint(db, { turnSeq: 1, participants: parts });

    db.prepare("UPDATE custom_domain SET v='2' WHERE k='a'").run();
    restore(db, snapId, parts);
    expect((db.prepare("SELECT v FROM custom_domain WHERE k='a'").get() as { v: string }).v).toBe("1");
  });

  it("registerSnapshotParticipant 注册的全局 participant 被默认 checkpoint/restore 采用", () => {
    const db = freshDb();
    db.exec("CREATE TABLE plugin_state (k TEXT PRIMARY KEY, v TEXT)");
    db.prepare("INSERT INTO plugin_state VALUES ('x', 'orig')").run();
    const unregister = registerSnapshotParticipant(tableParticipant("plugin", "plugin_state"));
    try {
      const snapId = checkpoint(db, { turnSeq: 1 });
      db.prepare("UPDATE plugin_state SET v='changed'").run();
      restore(db, snapId);
      expect((db.prepare("SELECT v FROM plugin_state WHERE k='x'").get() as { v: string }).v).toBe("orig");
    } finally {
      unregister();
    }
  });
});

// TR3 additive：transcript_anchor 列 + restoreToAnchor（db 快照锤到 transcript uuid）。
describe("snapshot transcript_anchor（TR3：锤到 transcript uuid）", () => {
  function anchorOf(db: DB, id: number): string | null {
    return (db.prepare("SELECT transcript_anchor a FROM snapshot WHERE id=?").get(id) as { a: string | null }).a;
  }

  it("checkpoint 带 anchorUuid → 落 transcript_anchor 列；省略 → NULL（旧 seq-based 路径兼容）", () => {
    const db = freshDb();
    const withAnchor = checkpoint(db, { turnSeq: 1, anchorUuid: "uuid-abc" });
    const without = checkpoint(db, { turnSeq: 2 });
    expect(anchorOf(db, withAnchor)).toBe("uuid-abc");
    expect(anchorOf(db, without)).toBeNull();
  });

  it("restoreToAnchor 按 uuid 反查快照并整表覆写回该锚点态", () => {
    const db = freshDb();
    setSheet(db, "你", "HP", "10");
    checkpoint(db, { turnSeq: 1, anchorUuid: "turn-1-end" });

    // 锚点后状态变更
    setSheet(db, "你", "HP", "3");
    setSheet(db, "你", "金币", "99");

    restoreToAnchor(db, "turn-1-end");
    expect(getSheet(db, "你", "HP")).toBe("10"); // 回到锚点态
    expect(getSheet(db, "你", "金币")).toBeUndefined(); // 锚点后新增被抹
  });

  it("restoreToAnchor 对未知锚点抛 no_snapshot_for_anchor", () => {
    const db = freshDb();
    checkpoint(db, { turnSeq: 1, anchorUuid: "known" });
    expect(() => restoreToAnchor(db, "unknown-uuid")).toThrow(/no_snapshot_for_anchor/);
  });

  it("同 uuid 多份快照 → restoreToAnchor 取最新一份", () => {
    const db = freshDb();
    setSheet(db, "你", "HP", "10");
    checkpoint(db, { turnSeq: 1, anchorUuid: "dup" });
    setSheet(db, "你", "HP", "7");
    checkpoint(db, { turnSeq: 2, anchorUuid: "dup" }); // 更晚一份，HP=7
    setSheet(db, "你", "HP", "1");
    restoreToAnchor(db, "dup");
    expect(getSheet(db, "你", "HP")).toBe("7"); // 取 id 最大（最新）那份
  });
});

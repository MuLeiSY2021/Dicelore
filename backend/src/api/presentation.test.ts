// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/backend";
import { buildSnapshot, buildNarrativeChanges } from "./presentation.js";

// 用 core 内部 store 表直写播种最小态(schema 见 packages/core/src/store/db.ts initSchema)。
function seedCell(db: ReturnType<typeof openDb>, entity: string, attr: string, value: string) {
  db.prepare("INSERT INTO state (entity, attr, value, visible) VALUES (?,?,?,1)").run(entity, attr, value);
}
function seedEvent(db: ReturnType<typeof openDb>, kind: string, content: string) {
  db.prepare("INSERT INTO log (content, kind, visible) VALUES (?,?,1)").run(content, kind);
}
function seedPlotline(db: ReturnType<typeof openDb>, id: string, title: string, status: string) {
  db.prepare("INSERT INTO plotline (id, title, status) VALUES (?,?,?)").run(id, title, status);
}
function seedForeshadow(db: ReturnType<typeof openDb>, id: string, content: string, status: string, visible: number) {
  db.prepare("INSERT INTO foreshadow (id, content, status, visible) VALUES (?,?,?,?)").run(id, content, status, visible);
}
function seedFront(db: ReturnType<typeof openDb>, id: string, name: string, status: string) {
  db.prepare("INSERT INTO front (id, name, status) VALUES (?,?,?)").run(id, name, status);
}
function seedLore(db: ReturnType<typeof openDb>, name: string, content: string, visible: number) {
  db.prepare("INSERT INTO lore (name, content, visible) VALUES (?,?,?)").run(name, content, visible);
}

describe("buildSnapshot", () => {
  it("空库返回合法空快照", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const snap = buildSnapshot(db, "s1");
    expect(snap.protocol).toBe("dicelore.client/1");
    expect(snap.sessionId).toBe("s1");
    expect(snap.sheets).toEqual([]);
    expect(snap.mechanics).toEqual([]);
    expect(snap.choices).toBeNull();
    expect(snap.seq).toBe(0);
    expect(snap.narrativeCursor).toBe(0);
    expect(snap.pendingRoll).toBeNull();
  });

  it("可见 sheet cell 按 entity 分组进 sheets", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedCell(db, "张三", "HP", "12");
    seedCell(db, "张三", "金钱", "77");
    const snap = buildSnapshot(db, "s1");
    expect(snap.sheets).toEqual([
      { entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }, { attr: "金钱", value: "77", visible: 1 }] },
    ]);
  });

  it("机械 event 映射进 mechanics，narrate 推进 narrativeCursor", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedEvent(db, "narrate", "你推开门");          // seq 1
    seedEvent(db, "mutation", "金钱 +3d100=74 → 77"); // seq 2
    const snap = buildSnapshot(db, "s1");
    expect(snap.mechanics).toEqual([{ seq: 2, kind: "mutation", text: "金钱 +3d100=74 → 77" }]);
    expect(snap.narrativeCursor).toBe(1);
    expect(snap.seq).toBe(2);
  });
});

// §7(A′) presentation 接叙事视图层(RT-FE4 收口)：玩家可见范围过滤(裁决 §7 C7/C8)。
describe("buildSnapshot 叙事层可见范围", () => {
  it("空库：叙事三字段为空数组", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const snap = buildSnapshot(db, "s1");
    expect(snap.plotlines).toEqual([]);
    expect(snap.foreshadows).toEqual([]);
    expect(snap.lore).toEqual([]);
  });

  it("foreshadow：planted(visible=0)不含；recalled+visible=1 才含", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedForeshadow(db, "fs1", "断剑", "planted", 0);
    expect(buildSnapshot(db, "s1").foreshadows).toEqual([]);
    // recall 但未 show(visible=0)：仍不下发
    db.prepare("UPDATE foreshadow SET status='recalled' WHERE id='fs1'").run();
    expect(buildSnapshot(db, "s1").foreshadows).toEqual([]);
    // recall + show：进快照
    db.prepare("UPDATE foreshadow SET visible=1 WHERE id='fs1'").run();
    expect(buildSnapshot(db, "s1").foreshadows).toEqual([
      { id: "fs1", content: "断剑", status: "recalled" },
    ]);
  });

  it("plotline：active/closed 进快照；open 不进；front 不进", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedPlotline(db, "pl_open", "开幕", "open");
    seedPlotline(db, "pl_active", "追查", "active");
    seedPlotline(db, "pl_closed", "尘埃落定", "closed");
    seedFront(db, "fr1", "魔道入侵", "active"); // front 从不进 plotlines
    const snap = buildSnapshot(db, "s1");
    expect(snap.plotlines).toEqual([
      { id: "pl_active", title: "追查", summary: null, status: "active" },
      { id: "pl_closed", title: "尘埃落定", summary: null, status: "closed" },
    ]);
  });

  it("lore：visible=1 进快照；visible=0 不进", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedLore(db, "青云门", "正道大派", 1);
    seedLore(db, "魔教秘辛", "不可说", 0);
    const snap = buildSnapshot(db, "s1");
    expect(snap.lore).toEqual([{ name: "青云门", content: "正道大派", category: null }]);
  });
});

describe("buildNarrativeChanges (WS delta 叙事部分)", () => {
  it("recalled+visible=1 foreshadow → delta.foreshadows 含 upsert", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedForeshadow(db, "fs1", "断剑", "recalled", 1);
    const changes = buildNarrativeChanges(db);
    expect(changes.foreshadows).toEqual([
      { id: "fs1", content: "断剑", status: "recalled", op: "upsert" },
    ]);
  });

  it("planted(visible=0) foreshadow → 不产出 foreshadows 字段", () => {
    const db = openDb(":memory:");
    initSchema(db);
    seedForeshadow(db, "fs1", "断剑", "planted", 0);
    const changes = buildNarrativeChanges(db);
    expect(changes.foreshadows).toBeUndefined();
  });
});

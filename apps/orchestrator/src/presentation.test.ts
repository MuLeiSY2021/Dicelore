// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/core";
import { buildSnapshot } from "./presentation.js";

// 用 core 内部 store 表直写播种最小态(schema 见 packages/core/src/store/db.ts initSchema)。
function seedCell(db: ReturnType<typeof openDb>, entity: string, attr: string, value: string) {
  db.prepare("INSERT INTO sheet (entity, attr, value, visible) VALUES (?,?,?,1)").run(entity, attr, value);
}
function seedEvent(db: ReturnType<typeof openDb>, kind: string, content: string) {
  db.prepare("INSERT INTO event (content, kind, visible) VALUES (?,?,1)").run(content, kind);
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

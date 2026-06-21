// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { eventAppend } from "../store/event.js";
import { sheetSetRaw } from "../store/sheet.js";
import { sheetShow } from "../store/visibility.js";
import { stagePendingChoice, materializePendingChoice } from "../store/choice.js";
import { buildPresentationModel } from "./model.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

describe("buildPresentationModel", () => {
  it("statusMenu 只含可见 cell:visible=1 或 __show_all 且 visible≠2", () => {
    const db = freshDb();
    sheetSetRaw(db, "张三", "HP", "30");          // 默认 visible=0,隐
    sheetSetRaw(db, "张三", "金币", "100", 1);     // 显式可见
    sheetSetRaw(db, "李四", "AC", "15");          // 隐
    sheetSetRaw(db, "李四", "暗值", "9", 2);       // 强制隐
    sheetShow(db, "李四");                        // __show_all → 暴露 李四 非暗值 cell
    const m = buildPresentationModel(db);
    const keys = m.statusMenu.map((c) => `${c.entity}.${c.attr}`).sort();
    expect(keys).toEqual(["张三.金币", "李四.AC"]); // 张三.HP 隐;李四.暗值(visible=2)不露;__show_all 标记本身不列
  });

  it("mechanicalEcho 取本轮 verdict/mutation/watcher_fired(按 turnStartSeq 圈区间)", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "旧轮" });        // seq1,非机械类
    const cut = (db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number }).s;
    eventAppend(db, { kind: "verdict", content: "命中", data_json: { winner: "a" } }); // seq2
    eventAppend(db, { kind: "narrate", content: "色彩" });        // seq3,不进 echo
    eventAppend(db, { kind: "mutation", content: "金钱 +3d100=74 → 77" }); // seq4
    const m = buildPresentationModel(db, { turnStartSeq: cut });
    expect(m.mechanicalEcho.map((e) => e.kind)).toEqual(["verdict", "mutation"]);
    expect(m.mechanicalEcho[1].text).toBe("金钱 +3d100=74 → 77");
  });

  it("pendingChoice 取最新 kind=choice 的 prompt+options", () => {
    const db = freshDb();
    stagePendingChoice(db, "怎么走?", [
      { label: "进", consequence: "遇敌" },
      { label: "退", consequence: "失机" },
    ]);
    const seq = materializePendingChoice(db)!;
    const m = buildPresentationModel(db);
    expect(m.pendingChoice?.prompt).toBe("怎么走?");
    expect(m.pendingChoice?.options).toHaveLength(2);
    expect(m.pendingChoice?.seq).toBe(seq);
  });

  it("无 choice event → pendingChoice 为 undefined", () => {
    const db = freshDb();
    expect(buildPresentationModel(db).pendingChoice).toBeUndefined();
  });
});

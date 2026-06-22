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
import { stateSet } from "../store/state.js";
import { sheetShow, revealOnce } from "../store/visibility.js";
import { buildPlayerView } from "./playerView.js";

function freshDb() {
  const db = openDb(":memory:");
  initSchema(db);
  return db;
}

describe("buildPlayerView", () => {
  it("narration = 可见 narrate + reveal,按 seq 排;不含 verdict/mutation/note", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "雨下了三天。" }); // seq1 可见
    eventAppend(db, { kind: "verdict", content: "命中" }); // seq2 → 进面板不进 narration
    eventAppend(db, { kind: "note", content: "伏笔", visible: 0 }); // seq3 隐,不进
    stateSet(db, "玩家", "HP", "30");
    revealOnce(db, { kind: "sheet", entity: "玩家", attr: "HP" }); // seq4 reveal 可见
    const pv = buildPlayerView(db);
    expect(pv.narration.map((n) => n.kind)).toEqual(["narrate", "reveal"]);
    expect(pv.narration[0].text).toBe("雨下了三天。");
    expect(pv.narration[1].text).toContain("玩家.HP");
  });

  it("隐藏的 narrate(visible=0)不进 narration", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "公开剧情" }); // 默认 visible=1
    eventAppend(db, { kind: "narrate", content: "GM 私货", visible: 0 });
    const pv = buildPlayerView(db);
    expect(pv.narration).toHaveLength(1);
    expect(pv.narration[0].text).toBe("公开剧情");
  });

  it("panel = buildPresentationModel:可见 cell 进状态菜单", () => {
    const db = freshDb();
    stateSet(db, "玩家", "金币", "50", 1); // 可见
    stateSet(db, "玩家", "暗值", "9", 2); // 强制隐
    const pv = buildPlayerView(db);
    const keys = pv.panel.statusMenu.map((c) => `${c.entity}.${c.attr}`);
    expect(keys).toContain("玩家.金币");
    expect(keys).not.toContain("玩家.暗值");
  });

  it("sinceSeq 圈定本轮 narration 与面板机械回显", () => {
    const db = freshDb();
    eventAppend(db, { kind: "narrate", content: "旧轮" }); // seq1
    const cut = (db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number }).s;
    eventAppend(db, { kind: "narrate", content: "本轮" }); // seq2
    const pv = buildPlayerView(db, { sinceSeq: cut });
    expect(pv.narration.map((n) => n.text)).toEqual(["本轮"]);
  });
});

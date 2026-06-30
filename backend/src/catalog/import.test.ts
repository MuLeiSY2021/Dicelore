// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "./db.js";
import { commit } from "./catalog.js";
import { importPack, validatePack } from "./import.js";
import { openDb, initSchema } from "../store/db.js";

// 闸门一致性回归：sheets/ 段是 validatePack 绿灯的开局状态段(Rule 5b)，
// importPack 须与 state/ 一并物化进 state 表——否则 sheets/*.csv 过校验却被静默丢弃。
describe("importPack 闸门：sheets/ 与 state/ 一致物化", () => {
  it("sheets/开局.csv 过 validatePack 且被物化进 state 表(不被静默丢弃)", () => {
    const files = [
      { path: "manifest.md", content: "# 沉默丢弃回归" },
      { path: "prologue.md", content: "你是 GM。" },
      { path: "sheets/开局.csv", content: "entity,kind,attr,value,visible\n勇者,player,HP,30,1\n" },
    ];
    // 先确认 validatePack(信任闸门)接受 sheets/ 段
    expect(validatePack(files).ok).toBe(true);

    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "沉默丢弃回归", files, message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.adventureId, r.commitId);

    expect(res.stateCells).toBe(1); // sheets/ 行计入 stateCells(此前为 0=被丢弃)
    const cell = run.prepare("SELECT kind, value, visible FROM state WHERE entity='勇者' AND attr='HP'").get() as { kind: string; value: string; visible: number };
    expect(cell).toEqual({ kind: "player", value: "30", visible: 1 });
    cat.close(); run.close();
  });

  it("state/ 与 sheets/ 同包并存时两段行都物化", () => {
    const files = [
      { path: "manifest.md", content: "# 双段" },
      { path: "prologue.md", content: "你是 GM。" },
      { path: "state/世界.csv", content: "entity,kind,attr,value,visible\n世界,world,时辰,子时,0\n" },
      { path: "sheets/角色.csv", content: "entity,kind,attr,value,visible\n甲,player,等级,1,1\n" },
    ];
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "双段", files, message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.adventureId, r.commitId);

    expect(res.stateCells).toBe(2);
    const n = run.prepare("SELECT COUNT(*) n FROM state").get() as { n: number };
    expect(n.n).toBe(2);
    cat.close(); run.close();
  });
});

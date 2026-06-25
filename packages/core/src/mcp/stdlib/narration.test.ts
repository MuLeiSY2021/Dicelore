// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test, beforeEach } from "vitest";
import { openDb, initSchema, type DB } from "../../store/db.js";
import { frontList } from "../../store/front.js";
import { foreshadowList } from "../../store/foreshadow.js";
import { narrationToolDecls, narrationStdlibTools } from "./narration.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

describe("叙事层标准库声明", () => {
  test("每条声明都能编译为 ToolDef（无坏 sql）", () => {
    const tools = narrationStdlibTools();
    expect(tools.length).toBe(narrationToolDecls.length);
    expect(tools.length).toBeGreaterThanOrEqual(8);
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.handler).toBe("function");
    }
  });

  test("名集覆盖叙事业务动词，无 front_advance（撞天花板）", () => {
    const names = narrationToolDecls.map((d) => d.name);
    for (const n of ["front_open", "plotline_open", "plotline_advance", "plotline_close", "foreshadow_plant", "foreshadow_recall", "foreshadow_abandon", "tension_board"]) {
      expect(names).toContain(n);
    }
    expect(names).not.toContain("front_advance");
  });

  test("front_open 工具经 handler 落库（走正典 frontUpsert）", () => {
    const tools = narrationStdlibTools();
    const frontOpen = tools.find((t) => t.name === "front_open")!;
    frontOpen.handler(db, { id: "f1", name: "城门攻防", stakes: "城破则民死" });
    const fronts = frontList(db);
    expect(fronts).toHaveLength(1);
    expect(fronts[0]).toMatchObject({ id: "f1", name: "城门攻防", status: "active" });
  });

  test("foreshadow_plant + foreshadow_recall 状态机经 handler 流转", () => {
    const tools = narrationStdlibTools();
    const plant = tools.find((t) => t.name === "foreshadow_plant")!;
    const recall = tools.find((t) => t.name === "foreshadow_recall")!;
    plant.handler(db, { id: "fs1", content: "神秘信物" });
    expect(foreshadowList(db)[0]).toMatchObject({ id: "fs1", status: "planted" });
    recall.handler(db, { id: "fs1", status: "recalled" });
    expect(foreshadowList(db)[0]).toMatchObject({ id: "fs1", status: "recalled" });
  });

  test("tension_board 读工具列未结张力（结果包 result）", () => {
    const tools = narrationStdlibTools();
    const plant = tools.find((t) => t.name === "foreshadow_plant")!;
    plant.handler(db, { id: "fs1", content: "信物" });
    const board = tools.find((t) => t.name === "tension_board")!;
    const out = board.handler(db, {}) as { result: unknown[] };
    expect(Array.isArray(out.result)).toBe(true);
    expect(out.result).toContainEqual({ kind: "foreshadow", id: "fs1", label: "信物", status: "planted" });
  });
});

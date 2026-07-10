// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test, beforeEach } from "vitest";
import { openDb, initSchema, openSessionBackend, type DB } from "@dicelore/backend";
import { stateSet } from "@dicelore/backend";
import { wrapToolForTest } from "@dicelore/harness";
import { worldToolDecls, worldStdlibTools } from "./world.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

type Row = { entity: string; attr: string; value: string; visible: number; kind: string };
const unwrap = <T>(x: unknown): T => (x as { result: T }).result;

describe("世界态类型化读标准库（A′ §4）", () => {
  test("每条声明都能编译为 ToolDef（无坏 sql）", () => {
    const tools = worldStdlibTools();
    expect(tools.length).toBe(worldToolDecls.length);
    for (const t of tools) expect(typeof t.handler).toBe("function");
  });

  test("world_state 类型化读：仅返回 kind=world 行、每行 kind=world", () => {
    // 铺三种 kind 的 state 行，验证只读到 world
    stateSet(db, "村口", "天气", "雨", 1, "world");
    stateSet(db, "主角", "HP", "30", 0, "player");
    stateSet(db, "铁匠", "简介", "老铁匠", 0, "npc");
    const rows = unwrap<Row[]>(worldStdlibTools().find((t) => t.name === "world_state")!.handler(db, {}));
    expect(rows.every((r) => r.kind === "world")).toBe(true);
    expect(rows).toContainEqual(expect.objectContaining({ entity: "村口", attr: "天气", value: "雨", kind: "world" }));
    expect(rows.some((r) => r.entity === "主角" || r.entity === "铁匠")).toBe(false); // 不漏 player/npc
  });

  test("dogfooding：world_state 经信封端到端读到 world 行", async () => {
    stateSet(db, "祭坛", "启动", "1", 1, "world");
    const invoke = wrapToolForTest(openSessionBackend(db), db, {}, worldStdlibTools());
    const res = (await invoke("world_state", {})) as { content: { text: string }[]; isError?: boolean };
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.result).toContainEqual(expect.objectContaining({ entity: "祭坛", attr: "启动", kind: "world" }));
  });
});

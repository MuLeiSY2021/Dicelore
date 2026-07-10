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
import { logSince } from "@dicelore/backend";
import { wrapToolForTest } from "@dicelore/harness";
import { playerToolDecls, playerStdlibTools } from "./player.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

type Row = { entity: string; attr: string; value: string; visible: number; kind: string };
const unwrap = <T>(x: unknown): T => (x as { result: T }).result;

describe("玩家卡类型化读写标准库（A′ §4）", () => {
  test("每条声明都能编译为 ToolDef（无坏 sql）", () => {
    const tools = playerStdlibTools();
    expect(tools.length).toBe(playerToolDecls.length);
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.handler).toBe("function");
    }
  });

  test("名集含 player_card / player_update_hp", () => {
    const names = playerToolDecls.map((d) => d.name);
    expect(names).toContain("player_card");
    expect(names).toContain("player_update_hp");
  });

  test("player_update_hp 落 kind=player 行 → player_card 读得到、每行 kind=player", () => {
    const tools = playerStdlibTools();
    tools.find((t) => t.name === "player_update_hp")!.handler(db, { entity: "主角", delta: 40 });
    tools.find((t) => t.name === "player_update_hp")!.handler(db, { entity: "主角", delta: -5 });
    const rows = unwrap<Row[]>(tools.find((t) => t.name === "player_card")!.handler(db, { entity: "主角" }));
    expect(rows.every((r) => r.kind === "player")).toBe(true);
    expect(rows).toContainEqual(expect.objectContaining({ entity: "主角", attr: "HP", value: "35", kind: "player" }));
  });

  test("player 写不串到 world 视图（kind 隔离）", () => {
    const tools = playerStdlibTools();
    tools.find((t) => t.name === "player_update_hp")!.handler(db, { entity: "主角", delta: 10 });
    const worldRows = db.prepare("SELECT entity FROM world WHERE entity='主角'").all();
    expect(worldRows).toHaveLength(0);
  });

  test("player_card 只读指定 entity（不返回其它玩家）", () => {
    const tools = playerStdlibTools();
    const hp = tools.find((t) => t.name === "player_update_hp")!;
    hp.handler(db, { entity: "甲", delta: 1 });
    hp.handler(db, { entity: "乙", delta: 1 });
    const rows = unwrap<Row[]>(tools.find((t) => t.name === "player_card")!.handler(db, { entity: "甲" }));
    expect(rows.every((r) => r.entity === "甲")).toBe(true);
  });
});

describe("dogfooding：玩家声明工具经 MCP server 端到端", () => {
  let invoke: (name: string, args: unknown) => Promise<unknown>;
  beforeEach(() => {
    invoke = wrapToolForTest(openSessionBackend(db), db, {}, playerStdlibTools());
  });

  async function call(name: string, args: unknown): Promise<any> {
    const res = (await invoke(name, args)) as { content: { text: string }[]; isError?: boolean };
    expect(res.isError).toBeFalsy();
    return JSON.parse(res.content[0].text);
  }

  test("player_update_hp 经信封落 mutation event（承重墙不破：经正典 applyMutations）", async () => {
    await call("player_update_hp", { entity: "主角", delta: -10 });
    const muts = logSince(db, 0).filter((e) => e.kind === "mutation");
    expect(muts.length).toBeGreaterThanOrEqual(1);
  });

  test("坏参数被 inputSchema 拦（缺 entity）", async () => {
    const res = (await invoke("player_card", {})) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

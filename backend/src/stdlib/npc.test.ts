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
import { npcToolDecls, npcStdlibTools } from "./npc.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
});

// npc 视图读侧（store/views.ts 已投影 WHERE kind='npc'）。
function npcView(db: DB): { entity: string; attr: string; value: string; visible: number }[] {
  return db.prepare("SELECT entity, attr, value, visible FROM npc ORDER BY entity, attr").all() as any[];
}

describe("NPC 一等抽象标准库声明（A1）", () => {
  test("每条声明都能编译为 ToolDef（无坏 sql）", () => {
    const tools = npcStdlibTools();
    expect(tools.length).toBe(npcToolDecls.length);
    expect(tools.length).toBeGreaterThanOrEqual(2);
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.handler).toBe("function");
    }
  });

  test("名集含 npc_register / npc_update_*", () => {
    const names = npcToolDecls.map((d) => d.name);
    expect(names).toContain("npc_register");
    expect(names).toContain("npc_update_affinity");
  });

  test("npc_register 落 kind=npc 行 → npc 视图读得到（这是 A1 核心：写侧入口接通读侧视图）", () => {
    const tools = npcStdlibTools();
    const reg = tools.find((t) => t.name === "npc_register")!;
    reg.handler(db, { npc: "村长", bio: "黄枫谷的老村长" });
    const rows = npcView(db);
    expect(rows).toContainEqual(
      expect.objectContaining({ entity: "村长", attr: "简介", value: "黄枫谷的老村长" }),
    );
  });

  test("npc_update_affinity 经 applyMutations 改好感、落 kind=npc、进 npc 视图", () => {
    const tools = npcStdlibTools();
    const aff = tools.find((t) => t.name === "npc_update_affinity")!;
    aff.handler(db, { npc: "村长", delta: 5 });
    aff.handler(db, { npc: "村长", delta: 3 });
    const rows = npcView(db);
    expect(rows).toContainEqual(expect.objectContaining({ entity: "村长", attr: "好感", value: "8" }));
  });

  test("npc 写不串到 world 视图（kind 隔离）", () => {
    const tools = npcStdlibTools();
    tools.find((t) => t.name === "npc_set_identity")!.handler(db, { npc: "村长", role: "叛徒" });
    const worldRows = db.prepare("SELECT entity FROM world WHERE entity='村长'").all();
    expect(worldRows).toHaveLength(0); // 不漏进 world 视图
  });

  test("npc_list 类型化读：返回 kind=npc 的行（A′ §4 替裸 sheet_list）", () => {
    const tools = npcStdlibTools();
    tools.find((t) => t.name === "npc_register")!.handler(db, { npc: "铁匠", bio: "城东老铁匠" });
    tools.find((t) => t.name === "npc_update_hp")!.handler(db, { npc: "铁匠", delta: 12 });
    const list = tools.find((t) => t.name === "npc_list")!;
    const rows = (list.handler(db, {}) as { result: { entity: string; attr: string; value: string; visible: number; kind: string }[] }).result;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // 每行 kind 恒 'npc'（投影常量列自证归属）
    expect(rows.every((r) => r.kind === "npc")).toBe(true);
    expect(rows).toContainEqual(expect.objectContaining({ entity: "铁匠", attr: "简介", value: "城东老铁匠", kind: "npc" }));
    expect(rows).toContainEqual(expect.objectContaining({ entity: "铁匠", attr: "HP", value: "12", kind: "npc" }));
  });
});

describe("dogfooding：NPC 声明工具经 MCP server 端到端", () => {
  let invoke: (name: string, args: unknown) => Promise<unknown>;
  beforeEach(() => {
    invoke = wrapToolForTest(openSessionBackend(db), db, {}, npcStdlibTools());
  });

  async function call(name: string, args: unknown): Promise<any> {
    const res = (await invoke(name, args)) as { content: { text: string }[]; isError?: boolean };
    expect(res.isError).toBeFalsy();
    return JSON.parse(res.content[0].text);
  }

  test("npc_register 经信封落库 → npc 视图读到", async () => {
    await call("npc_register", { npc: "铁匠", bio: "城东老铁匠" });
    const rows = npcView(db);
    expect(rows.some((r) => r.entity === "铁匠" && r.attr === "简介")).toBe(true);
  });

  test("npc 写落 mutation event（承重墙不破：经正典 applyMutations）", async () => {
    await call("npc_update_hp", { npc: "守卫", delta: -10 });
    const muts = logSince(db, 0).filter((e) => e.kind === "mutation");
    expect(muts.length).toBeGreaterThanOrEqual(1);
  });

  test("坏参数被 inputSchema 拦（缺 npc）", async () => {
    const res = (await invoke("npc_register", { bio: "无名" })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  test("框架零改动：npc 工具全部来自声明（不在硬编码 TOOLS 中）", async () => {
    const { BUILTIN_TOOL_NAMES } = await import("@dicelore/harness");
    const hardcoded = new Set(BUILTIN_TOOL_NAMES);
    for (const n of ["npc_register", "npc_update_affinity", "npc_update_hp", "npc_set_identity"]) {
      expect(hardcoded.has(n)).toBe(false);
    }
  });
});

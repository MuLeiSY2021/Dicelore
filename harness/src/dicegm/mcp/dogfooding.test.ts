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
import { wrapToolForTest } from "./server.js";
import { narrationStdlibTools } from "@dicelore/backend";
import { frontList } from "@dicelore/backend";
import { plotlineList } from "@dicelore/backend";

let db: DB;
let invoke: (name: string, args: unknown) => Promise<unknown>;
beforeEach(() => {
  db = openDb(":memory:");
  initSchema(db);
  invoke = wrapToolForTest(openSessionBackend(db), db, {}, narrationStdlibTools());
});

// 信封 → 解出业务出参
async function call(name: string, args: unknown): Promise<any> {
  const res = (await invoke(name, args)) as { content: { text: string }[]; isError?: boolean };
  expect(res.isError).toBeFalsy();
  return JSON.parse(res.content[0].text);
}

describe("dogfooding：声明叙事工具经 MCP server 端到端", () => {
  test("front_open 经信封落库（front 表 status=active）", async () => {
    await call("front_open", { id: "f1", name: "城门攻防", stakes: "城破民死" });
    expect(frontList(db)).toHaveLength(1);
    expect(frontList(db)[0]).toMatchObject({ id: "f1", name: "城门攻防", status: "active" });
  });

  test("plotline 开→推进→收口 全流程经 server", async () => {
    await call("plotline_open", { id: "p1", title: "主线", summary: "救公主" });
    expect(plotlineList(db)[0].status).toBe("open");
    await call("plotline_advance", { id: "p1", status: "active" });
    expect(plotlineList(db)[0].status).toBe("active");
    await call("plotline_close", { id: "p1", status: "closed" });
    expect(plotlineList(db)[0].status).toBe("closed");
  });

  test("tension_board 经 server 列出多源未结张力", async () => {
    await call("front_open", { id: "f1", name: "攻城", stakes: "x" });
    await call("plotline_open", { id: "p1", title: "主线", summary: "y" });
    await call("foreshadow_plant", { id: "fs1", content: "信物" });
    const board = await call("tension_board", {});
    // 信封出参 = handler 的 {result: [...]}
    const kinds = (board.result as { kind: string }[]).map((r) => r.kind).sort();
    expect(kinds).toEqual(["foreshadow", "front", "plotline"]);
  });

  test("坏参数被 inputSchema 拦（缺 id）", async () => {
    const res = (await invoke("front_open", { name: "无 id" })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  test("框架零改动验证：叙事工具全部来自声明（不在硬编码 TOOLS 中）", async () => {
    const { BUILTIN_TOOL_NAMES } = await import("./tools.js");
    const hardcodedNames = new Set(BUILTIN_TOOL_NAMES);
    for (const n of ["front_open", "plotline_open", "foreshadow_plant", "tension_board"]) {
      expect(hardcodedNames.has(n)).toBe(false); // 不硬编码
    }
  });
});

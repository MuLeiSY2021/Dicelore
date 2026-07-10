// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "../catalog/db.js";
import { history, checkout } from "../catalog/catalog.js";
import { Draft } from "./draft.js";
import { invokeBuildTool, type BuildCtx, type BuildHooks, type BuildToolcallEvent, type BuildWriteEvent } from "./buildMcp.js";

function ctx(): BuildCtx { return { catalog: openCatalog(":memory:"), draft: new Draft(), name: "凡人" }; }

describe("invokeBuildTool", () => {
  it("逐工具累积 draft → commit 落 Catalog → tag", () => {
    const c = ctx();
    expect(invokeBuildTool(c, "set_manifest", { name: "凡人", id: "f" }).isError).toBeFalsy();
    invokeBuildTool(c, "write_lore", { name: "黄枫谷", content: "正道" });
    invokeBuildTool(c, "add_pool", { pool: "灵根", rows: [{ 名称: "天灵根" }] });
    invokeBuildTool(c, "set_state", { cells: [{ entity: "韩立", kind: "player", attr: "资质", value: "五灵根" }] });
    invokeBuildTool(c, "set_prologue", { text: "开场白：游戏开始，你们来到了江南。" });
    const r = JSON.parse(invokeBuildTool(c, "commit", { message: "init" }).content[0].text) as { adventureId: string; commitId: string };
    expect(history(c.catalog, r.adventureId).map((x) => x.message)).toEqual(["init"]);
    const files = checkout(c.catalog, r.adventureId, r.commitId).map((f) => f.path).sort();
    expect(files).toEqual(["lore/黄枫谷.md", "manifest.md", "pools/灵根.csv", "prologue.md", "state/开局.csv"]);
    expect(invokeBuildTool(c, "tag", { commitId: r.commitId, label: "v1" }).isError).toBeFalsy();
    expect(checkout(c.catalog, r.adventureId, "v1").length).toBe(5);
    c.catalog.close();
  });

  it("入参非法 / 未知工具 → isError", () => {
    const c = ctx();
    expect(invokeBuildTool(c, "write_lore", { name: "x" }).isError).toBe(true); // 缺 content
    expect(invokeBuildTool(c, "bogus", {}).isError).toBe(true);
    c.catalog.close();
  });
});

// loregm WS hook（裁决 §二 C3/C4）：invokeBuildTool 带 hooks 时发 toolcall（总发）+ draft_delta（写 Draft 成功时）。
describe("invokeBuildTool hooks（loregm WS toolcall/draft_delta）", () => {
  function collect() {
    const calls: BuildToolcallEvent[] = [];
    const writes: BuildWriteEvent[] = [];
    const hooks: BuildHooks = { onToolcall: (e) => calls.push(e), onBuilderWrite: (e) => writes.push(e) };
    return { calls, writes, hooks };
  }

  it("写 Draft 工具：发 toolcall(ok) + draft_delta(section + 递增 seq)", () => {
    const c = ctx();
    const { calls, writes, hooks } = collect();
    invokeBuildTool(c, "write_lore", { name: "黄枫谷", content: "正道" }, hooks);
    expect(calls).toEqual([{ tool: "write_lore", args: { name: "黄枫谷", content: "正道" }, result: { ok: true }, ok: true }]);
    expect(writes).toEqual([{ seq: 1, changes: [{ section: "world" }] }]);
    invokeBuildTool(c, "add_pool", { pool: "灵根", rows: [{ 名称: "天灵根" }] }, hooks);
    expect(writes[1]).toEqual({ seq: 2, changes: [{ section: "pools" }] }); // seq 递增
    c.catalog.close();
  });

  it("只读/落库工具（read/validate/commit）：发 toolcall、不发 draft_delta", () => {
    const c = ctx();
    invokeBuildTool(c, "set_manifest", { name: "凡人", id: "f" });
    invokeBuildTool(c, "set_prologue", { text: "开场" });
    invokeBuildTool(c, "write_lore", { name: "x", content: "y" });
    invokeBuildTool(c, "write_rule", { name: "r", content: "1d100" });
    invokeBuildTool(c, "set_state", { cells: [{ entity: "韩立", attr: "资质", value: "五灵根" }] });
    const { calls, writes, hooks } = collect();
    invokeBuildTool(c, "read", { section: "world" }, hooks);
    invokeBuildTool(c, "validate", {}, hooks);
    invokeBuildTool(c, "commit", { message: "init" }, hooks);
    expect(calls.map((e) => e.tool)).toEqual(["read", "validate", "commit"]);
    expect(writes).toEqual([]); // 只读/落库不产 draft_delta
    c.catalog.close();
  });

  it("工具失败：发 toolcall(ok=false)、不发 draft_delta", () => {
    const c = ctx();
    const { calls, writes, hooks } = collect();
    invokeBuildTool(c, "write_lore", { name: "缺 content" }, hooks); // 校验失败
    expect(calls.length).toBe(1);
    expect(calls[0].ok).toBe(false);
    expect(writes).toEqual([]);
    c.catalog.close();
  });

  it("不传 hooks 时行为不变（可测核心向后兼容）", () => {
    const c = ctx();
    expect(invokeBuildTool(c, "write_lore", { name: "黄枫谷", content: "正道" }).isError).toBeFalsy();
    c.catalog.close();
  });
});

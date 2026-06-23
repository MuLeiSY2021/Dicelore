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
import { invokeBuildTool, type BuildCtx } from "./buildMcp.js";

function ctx(): BuildCtx { return { catalog: openCatalog(":memory:"), draft: new Draft(), name: "凡人" }; }

describe("invokeBuildTool", () => {
  it("逐工具累积 draft → commit 落 Catalog → tag", () => {
    const c = ctx();
    expect(invokeBuildTool(c, "set_manifest", { name: "凡人", id: "f" }).isError).toBeFalsy();
    invokeBuildTool(c, "write_lore", { name: "黄枫谷", content: "正道" });
    invokeBuildTool(c, "add_pool", { pool: "灵根", rows: [{ 名称: "天灵根" }] });
    invokeBuildTool(c, "set_state", { cells: [{ entity: "韩立", kind: "player", attr: "资质", value: "五灵根" }] });
    invokeBuildTool(c, "set_prologue", { text: "开场白：游戏开始，你们来到了江南。" });
    const r = JSON.parse(invokeBuildTool(c, "commit", { message: "init" }).content[0].text) as { tuanbenId: string; commitId: string };
    expect(history(c.catalog, r.tuanbenId).map((x) => x.message)).toEqual(["init"]);
    const files = checkout(c.catalog, r.tuanbenId, r.commitId).map((f) => f.path).sort();
    expect(files).toEqual(["lore/黄枫谷.md", "manifest.md", "pools/灵根.csv", "prologue.md", "state/开局.csv"]);
    expect(invokeBuildTool(c, "tag", { commitId: r.commitId, label: "v1" }).isError).toBeFalsy();
    expect(checkout(c.catalog, r.tuanbenId, "v1").length).toBe(5);
    c.catalog.close();
  });

  it("入参非法 / 未知工具 → isError", () => {
    const c = ctx();
    expect(invokeBuildTool(c, "write_lore", { name: "x" }).isError).toBe(true); // 缺 content
    expect(invokeBuildTool(c, "bogus", {}).isError).toBe(true);
    c.catalog.close();
  });
});

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
import { importPack } from "../catalog/import.js";
import { loreGet } from "../store/world.js";
import { ruleGet } from "../store/rule.js";
import { openDb, initSchema } from "../store/db.js";
import { Draft, commitDraft } from "./draft.js";

describe("Draft → commit → import 全链", () => {
  it("作者用 draft 造团本 → commitDraft → importPack 物化运行库,内容贯通", () => {
    const draft = new Draft();
    draft.setManifest({ name: "凡人修仙传", id: "fanren" });
    draft.setPrologue("你是 GM，请开始游戏。");
    draft.writeLore("黄枫谷", "江南正道。");
    draft.writeRule("修炼", "练气→筑基");
    draft.addPool("灵根", [{ 名称: "天灵根", weight: 1 }, { 名称: "五灵根", weight: 51 }]);
    draft.setState([{ entity: "韩立", kind: "player", attr: "资质", value: "五灵根", visible: 1 }]);

    const cat = openCatalog(":memory:");
    const r = commitDraft(cat, { name: "凡人修仙传", message: "init", draft, createdAt: "2026-01-01" });

    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res).toMatchObject({ lore: 1, rules: 1, pools: 2, stateCells: 1, fronts: 0, plotlines: 0, foreshadows: 0, anchors: 0 });
    expect(loreGet(run, "黄枫谷")?.content).toBe("江南正道。");
    expect(ruleGet(run, "修炼")?.content).toBe("练气→筑基");
    const cell = run.prepare("SELECT kind, value FROM state WHERE entity='韩立' AND attr='资质'").get() as { kind: string; value: string };
    expect(cell).toEqual({ kind: "player", value: "五灵根" });
    cat.close(); run.close();
  });
});

describe("Draft.setPrologue", () => {
  it("setPrologue 产出 prologue.md 文件，内容为传入文本", () => {
    const draft = new Draft();
    draft.setPrologue("你是 GM，请开始游戏。");
    const files = draft.toPackFiles();
    const pf = files.find((f) => f.path === "prologue.md");
    expect(pf).toBeDefined();
    expect(pf!.content).toBe("你是 GM，请开始游戏。");
  });

  it("未调用 setPrologue 时 toPackFiles 不产出 prologue.md", () => {
    const draft = new Draft();
    draft.writeLore("设定", "世界观。");
    const files = draft.toPackFiles();
    expect(files.some((f) => f.path === "prologue.md")).toBe(false);
  });

  it("多次调用 setPrologue → 后者覆盖，只有一个 prologue.md", () => {
    const draft = new Draft();
    draft.setPrologue("第一版开场。");
    draft.setPrologue("第二版开场，更好。");
    const files = draft.toPackFiles().filter((f) => f.path === "prologue.md");
    expect(files).toHaveLength(1);
    expect(files[0].content).toBe("第二版开场，更好。");
  });

  it("snapshot 含 prologue 字段", () => {
    const draft = new Draft();
    draft.setPrologue("开场白文本。");
    expect(draft.snapshot().prologue).toBe("开场白文本。");
  });

  it("未设置 prologue 时 snapshot.prologue 为 undefined", () => {
    const draft = new Draft();
    expect(draft.snapshot().prologue).toBeUndefined();
  });
});

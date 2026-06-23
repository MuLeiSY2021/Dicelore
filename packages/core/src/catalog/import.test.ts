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
import { loreGet } from "../store/world.js";
import { ruleGet } from "../store/rule.js";
import { openCatalog } from "./db.js";
import { commit, tag } from "./catalog.js";
import { importPack, validatePack } from "./import.js";

const PACK = [
  { path: "manifest.md", content: "# 凡人修仙传\n\n- id: fanren" },
  { path: "prologue.md", content: "你是 GM，请开始游戏。" },
  { path: "lore/黄枫谷.md", content: "黄枫谷乃江南正道。" },
  { path: "rules/修炼体系.md", content: "练气→筑基→结丹" },
  { path: "pools/灵根.csv", content: "名称,品级,weight\n天灵根,上品,1\n五灵根,下品,51\n" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n韩立,player,资质,五灵根,1\n墨大夫,npc,好感度,0,2\n" },
];

describe("importPack", () => {
  it("checkout 某版本 → 物化 lore/rule/pool/state 到运行库", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "凡人修仙传", files: PACK, message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    const res = importPack(cat, run, r.tuanbenId, r.commitId);
    expect(res).toEqual({ lore: 1, rules: 1, pools: 2, stateCells: 2 });
    expect(loreGet(run, "黄枫谷")?.content).toBe("黄枫谷乃江南正道。");
    expect(ruleGet(run, "修炼体系")?.content).toBe("练气→筑基→结丹");
    expect((run.prepare("SELECT COUNT(*) n FROM pool").get() as { n: number }).n).toBe(2);
    const cell = run.prepare("SELECT kind, value, visible FROM state WHERE entity='墨大夫' AND attr='好感度'").get() as { kind: string; value: string; visible: number };
    expect(cell).toEqual({ kind: "npc", value: "0", visible: 2 });
    cat.close(); run.close();
  });

  it("checkout(tag label) 也能物化", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "x", files: [{ path: "lore/a.md", content: "甲" }, { path: "prologue.md", content: "开场。" }], message: "init", createdAt: "2026-01-01" });
    tag(cat, { tuanbenId: r.tuanbenId, commitId: r.commitId, label: "v1" });
    const run = openDb(":memory:"); initSchema(run);
    importPack(cat, run, r.tuanbenId, "v1");
    expect(loreGet(run, "a")?.content).toBe("甲");
    cat.close(); run.close();
  });

  it("validatePack:空包 / 未知路径段 / state 缺列 → ok=false", () => {
    expect(validatePack([]).ok).toBe(false);
    expect(validatePack([{ path: "evil/x.md", content: "" }]).ok).toBe(false);
    expect(validatePack([{ path: "state/x.csv", content: "foo,bar\n1,2\n" }]).ok).toBe(false);
    expect(validatePack([{ path: "lore/x.md", content: "ok" }, { path: "prologue.md", content: "开场。" }]).ok).toBe(true);
  });

  it("importPack 对坏包抛错(信任闸门)", () => {
    const cat = openCatalog(":memory:");
    const r = commit(cat, { name: "bad", files: [{ path: "evil/x.md", content: "" }], message: "init", createdAt: "2026-01-01" });
    const run = openDb(":memory:"); initSchema(run);
    expect(() => importPack(cat, run, r.tuanbenId, r.commitId)).toThrow(/信任闸门/);
    cat.close(); run.close();
  });
});

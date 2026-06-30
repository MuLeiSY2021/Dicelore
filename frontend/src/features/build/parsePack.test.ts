// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { parsePack, topSeg } from "./parsePack.js";

describe("topSeg", () => {
  it("取顶层目录段并小写", () => {
    expect(topSeg("lore/序章.md")).toBe("lore");
    expect(topSeg("State/开局.csv")).toBe("state");
    expect(topSeg("manifest.md")).toBe("manifest.md"); // 无目录段时返回整路径
  });
});

describe("parsePack 分域（与后端 importPack 顶层目录分流对齐）", () => {
  it("lore/ → 设定文档；rules/ → 规则；fronts/ → 阵线；manifest 单独", () => {
    const m = parsePack([
      { path: "manifest.md", content: "# 黑风寨\n\n- id: bw" },
      { path: "lore/序章.md", content: "# 序章\n世界观" },
      { path: "rules/检定.md", content: "# 检定" },
      { path: "fronts/巨龙.md", content: "name: 巨龙" },
    ]);
    expect(m.manifest?.path).toBe("manifest.md");
    expect(m.lore.map((f) => f.path)).toEqual(["lore/序章.md"]);
    expect(m.rules.map((f) => f.path)).toEqual(["rules/检定.md"]);
    expect(m.fronts.map((f) => f.path)).toEqual(["fronts/巨龙.md"]);
  });

  it("state/*.csv → 实体卡，按 entity 聚合属性（含中文）", () => {
    const m = parsePack([
      { path: "state/开局.csv", content: "entity,kind,attr,value\n旅人,player,HP,12\n旅人,player,力量,3\n哥布林,npc,HP,5" },
    ]);
    const traveler = m.entities.find((e) => e.entity === "旅人");
    expect(traveler?.kind).toBe("player");
    expect(traveler?.cells).toEqual([{ attr: "HP", value: "12" }, { attr: "力量", value: "3" }]);
    const gob = m.entities.find((e) => e.entity === "哥布林");
    expect(gob?.kind).toBe("npc");
  });

  it("sheets/*.csv 与 state/ 等价（canonical 段名也认）", () => {
    const m = parsePack([
      { path: "sheets/开局.csv", content: "entity,kind,attr,value\n旅人,player,HP,9" },
    ]);
    expect(m.entities).toHaveLength(1);
    expect(m.entities[0].entity).toBe("旅人");
  });

  it("pools/*.csv → 卡池文档(DocCard)，不被当 state 实体", () => {
    const m = parsePack([
      { path: "pools/遭遇.csv", content: "name,weight\n野狼,2\n盗匪,1" },
    ]);
    expect(m.pools.map((f) => f.path)).toEqual(["pools/遭遇.csv"]);
    expect(m.entities).toHaveLength(0); // 关键：卡池 CSV 不混进实体卡
  });

  it("plotlines/foreshadows/anchors 等叙事域 CSV 既不进实体卡、也不进设定文档", () => {
    const m = parsePack([
      { path: "plotlines/主线.csv", content: "id,title\np1,寻宝" },
      { path: "foreshadows/伏笔.csv", content: "id,hint\nf1,密信" },
      { path: "anchors/锚点.csv", content: "id,note\na1,客栈" },
    ]);
    expect(m.entities).toHaveLength(0);
    expect(m.lore).toHaveLength(0);
    expect(m.rules).toHaveLength(0);
    expect(m.pools).toHaveLength(0);
  });

  it("根级 .md（非 lore/ 目录）回退归设定文档", () => {
    const m = parsePack([{ path: "prologue.md", content: "开场白" }]);
    expect(m.lore.map((f) => f.path)).toEqual(["prologue.md"]);
  });
});

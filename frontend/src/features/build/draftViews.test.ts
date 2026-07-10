// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { deriveViews, guidelineStages } from "./draftViews.js";
import type { DraftSnapshot } from "./api.js";

const full: DraftSnapshot = {
  manifest: { name: "黑风寨的钟声", id: "hei" },
  prologue: "夜色如墨……",
  world: { 黑风寨: "据点", 钟楼: "暗哨" },
  rules: { 潜行判定: "d20+{潜行}" },
  pools: { 机缘: [{ item: "残页", weight: 1 }, { item: "空手", weight: 5 }] },
  sheets: { cells: [
    { entity: "钟三爷", kind: "npc", attr: "HP", value: 40 },
    { entity: "钟三爷", kind: "npc", attr: "子母钟锤", value: "+6" },
    { entity: "张三", kind: "player", attr: "HP", value: 15 },
  ] },
  fronts: { 钟楼示警: { id: "钟楼示警", title: "钟楼示警", clockMax: 8 } },
  plotlines: [{ id: "夺图", title: "夺图", status: "进行中" }],
  foreshadows: [{ id: "暗格", content: "暗格", status: "未回收" }],
  anchors: [{ owner_table: "npc", owner_id: "钟三爷", target_table: "npc", target_id: "张三", role: "敌对" }],
};

describe("deriveViews", () => {
  it("空快照返回全空视图、计数全 0", () => {
    const v = deriveViews(null);
    expect(v.lore).toEqual([]);
    expect(v.npcs).toEqual([]);
    expect(v.counts.lore).toBe(0);
    expect(v.counts.manifest).toBe(0);
    expect(v.prologue).toBe("");
  });

  it("world/rules/pools 映射为条目 + 计数", () => {
    const v = deriveViews(full);
    expect(v.lore.map((l) => l.name)).toEqual(["黑风寨", "钟楼"]);
    expect(v.counts.lore).toBe(2);
    expect(v.rules).toHaveLength(1);
    expect(v.pools[0].rows).toHaveLength(2);
    expect(v.counts.pool).toBe(1);
  });

  it("sheets cells 按 kind 拆 npc / state 并聚合到实体", () => {
    const v = deriveViews(full);
    expect(v.npcs).toHaveLength(1);
    expect(v.npcs[0].entity).toBe("钟三爷");
    expect(v.npcs[0].cells).toHaveLength(2);
    expect(v.states).toHaveLength(1);
    expect(v.states[0].entity).toBe("张三");
    expect(v.counts.npc).toBe(1);
    expect(v.counts.state).toBe(1);
  });

  it("anchors 投影为 relation 边表", () => {
    const v = deriveViews(full);
    expect(v.relations).toHaveLength(1);
    expect(v.relations[0]).toEqual({ from: "npc:钟三爷", role: "敌对", to: "npc:张三" });
    expect(v.counts.relation).toBe(1);
  });

  it("manifest 有 name/id 时计数为 1", () => {
    expect(deriveViews(full).counts.manifest).toBe(1);
    expect(deriveViews({ ...full, manifest: {} }).counts.manifest).toBe(0);
  });
});

describe("guidelineStages", () => {
  it("空 Draft 无素材：source=now，其余空", () => {
    const s = guidelineStages(deriveViews(null), 0);
    expect(s.source).toBe("now");
    expect(s.world).toBe("");
  });

  it("有素材 + 世界观：source/world done，npc now", () => {
    const v = deriveViews({ ...full, sheets: { cells: [] }, pools: {}, rules: {}, manifest: {} });
    const s = guidelineStages(v, 2);
    expect(s.source).toBe("done");
    expect(s.world).toBe("done");
    expect(s.npc).toBe("now");
  });

  it("全域齐备：各阶段 done", () => {
    const s = guidelineStages(deriveViews(full), 2);
    expect(s.source).toBe("done");
    expect(s.world).toBe("done");
    expect(s.npc).toBe("done");
    expect(s.rule).toBe("done");
    expect(s.manifest).toBe("done");
  });
});

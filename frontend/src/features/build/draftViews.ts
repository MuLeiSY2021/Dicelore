// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 把 loregm Draft 分域快照（api.DraftSnapshot）投影成构建页各 data-view 的呈现模型 + 计数。
// 纯函数、独立成模块以便单测（对齐 parsePack.ts 的可测性约定）。
// data-view 键覆盖裁决 §三 sidenav 七组的内容域：五域(lore/npc/pool/rule/state) +
// 叙事脚手架(front/plotline/foreshadow/anchor/relation) + 收口(prologue/manifest) + 素材(materials)。

import type { DraftSnapshot, FrontSpec } from "@/features/build/api.js";

export type ViewKey =
  | "lore" | "npc" | "pool" | "rule" | "state"
  | "front" | "plotline" | "foreshadow" | "anchor" | "relation"
  | "prologue" | "manifest" | "materials";

export interface DocItem { name: string; content: string }
export interface EntityItem { entity: string; kind: string; cells: { attr: string; value: string }[] }
export interface PoolItem { name: string; rows: Record<string, string | number>[] }
export interface RelationEdge { from: string; role: string; to: string }

export interface DraftViews {
  lore: DocItem[];
  rules: DocItem[];
  pools: PoolItem[];
  fronts: FrontSpec[];
  plotlines: Record<string, string | number>[];
  foreshadows: Record<string, string | number>[];
  anchors: Record<string, string | number>[];
  relations: RelationEdge[];
  npcs: EntityItem[];
  states: EntityItem[];
  prologue: string;
  manifest: { name?: string; id?: string };
  /** 每个内容 data-view 的条目计数（sidenav 角标）。materials 由上传态另计，不在此。 */
  counts: Record<Exclude<ViewKey, "materials" | "prologue">, number>;
}

// 把 state cells 按实体聚合成实体卡（NPC / 玩家 / 世界物件）。kind 缺省 player。
function groupEntities(cells: DraftSnapshot["sheets"]["cells"]): EntityItem[] {
  const byEntity = new Map<string, EntityItem>();
  for (const c of cells) {
    const entity = String(c.entity ?? "").trim();
    if (!entity) continue;
    const kind = String(c.kind ?? "player");
    const e = byEntity.get(entity) ?? { entity, kind, cells: [] };
    if (c.attr) e.cells.push({ attr: String(c.attr), value: String(c.value ?? "") });
    byEntity.set(entity, e);
  }
  return [...byEntity.values()];
}

export function deriveViews(snap: DraftSnapshot | null | undefined): DraftViews {
  const s: DraftSnapshot = snap ?? {
    manifest: {}, world: {}, rules: {}, pools: {}, sheets: { cells: [] },
    fronts: {}, plotlines: [], foreshadows: [], anchors: [],
  };
  const lore = Object.entries(s.world ?? {}).map(([name, content]) => ({ name, content: String(content) }));
  const rules = Object.entries(s.rules ?? {}).map(([name, content]) => ({ name, content: String(content) }));
  const pools = Object.entries(s.pools ?? {}).map(([name, rows]) => ({ name, rows: rows ?? [] }));
  const fronts = Object.values(s.fronts ?? {});
  const entities = groupEntities(s.sheets?.cells ?? []);
  const npcs = entities.filter((e) => e.kind === "npc");
  const states = entities.filter((e) => e.kind !== "npc");
  // 关系边表：anchors 的 owner —role→ target。
  const relations: RelationEdge[] = (s.anchors ?? []).map((a) => ({
    from: `${a.owner_table ?? ""}${a.owner_id ? ":" + a.owner_id : ""}` || String(a.owner_id ?? "?"),
    role: String(a.role ?? "→"),
    to: `${a.target_table ?? ""}${a.target_id ? ":" + a.target_id : ""}` || String(a.target_id ?? "?"),
  }));
  return {
    lore, rules, pools, fronts,
    plotlines: s.plotlines ?? [], foreshadows: s.foreshadows ?? [], anchors: s.anchors ?? [],
    relations, npcs, states,
    prologue: s.prologue ?? "",
    manifest: s.manifest ?? {},
    counts: {
      lore: lore.length, npc: npcs.length, pool: pools.length, rule: rules.length, state: states.length,
      front: fronts.length, plotline: (s.plotlines ?? []).length, foreshadow: (s.foreshadows ?? []).length,
      anchor: (s.anchors ?? []).length, relation: relations.length,
      manifest: s.manifest?.name || s.manifest?.id ? 1 : 0,
    },
  };
}

// guideline 阶段态（done/now/空）：按各域是否有产物推断构建进度（裁决 §三 缺口 #8）。
export type StageState = "done" | "now" | "";
export function guidelineStages(v: DraftViews, materialsCount: number): Record<string, StageState> {
  const source: StageState = materialsCount > 0 ? "done" : "now";
  const world: StageState = v.counts.lore > 0 ? "done" : source === "done" ? "now" : "";
  const npc: StageState = v.counts.npc > 0 || v.counts.pool > 0 ? "done" : world === "done" ? "now" : "";
  const rule: StageState = v.counts.rule > 0 ? "done" : npc === "done" ? "now" : "";
  const manifest: StageState = v.manifest.name || v.manifest.id ? "done" : rule === "done" ? "now" : "";
  return { source, world, npc, rule, manifest };
}

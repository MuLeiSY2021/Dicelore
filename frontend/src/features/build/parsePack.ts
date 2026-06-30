// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 构建台预览模型解析（纯函数，独立成模块以便单测）。
// 分域规则与后端权威 importPack(backend/src/catalog/import.ts)对齐：按路径顶层目录段(topSeg)分流——
// lore/→设定、rules/→规则、pools/→卡池、fronts/→阵线、state/|sheets/→实体卡(sheet 域)。
// 其余域(plotlines/foreshadows/anchors)非 sheet 实体，不塞 byEntity。

import type { PackFile } from "@/features/catalog/api.js";

export interface Entity { entity: string; kind: string; cells: { attr: string; value: string }[] }
export interface Model {
  manifest: PackFile | null;
  lore: PackFile[]; rules: PackFile[]; pools: PackFile[]; fronts: PackFile[];
  entities: Entity[];
}

export function topSeg(path: string): string {
  const i = path.indexOf("/");
  return (i === -1 ? path : path.slice(0, i)).toLowerCase();
}

export function parsePack(files: PackFile[]): Model {
  const lore: PackFile[] = [], rules: PackFile[] = [], pools: PackFile[] = [], fronts: PackFile[] = [];
  let manifest: PackFile | null = null;
  const byEntity = new Map<string, Entity>();
  for (const f of files) {
    const top = topSeg(f.path);
    if (f.path.toLowerCase().includes("manifest")) manifest = f;
    else if (top === "rules") rules.push(f);
    else if (top === "pools") pools.push(f);
    else if (top === "fronts") fronts.push(f);
    else if (top === "state" || top === "sheets") {
      const lines = f.content.split(/\r?\n/).filter((l) => l.trim());
      const header = lines.shift()?.split(",").map((s) => s.trim()) ?? [];
      const ix = (k: string) => header.indexOf(k);
      for (const line of lines) {
        const cols = line.split(",");
        const entity = cols[ix("entity")]?.trim(); if (!entity) continue;
        const kind = cols[ix("kind")]?.trim() || "player";
        const attr = cols[ix("attr")]?.trim() ?? ""; const value = cols[ix("value")]?.trim() ?? "";
        const e = byEntity.get(entity) ?? { entity, kind, cells: [] };
        if (attr) e.cells.push({ attr, value });
        byEntity.set(entity, e);
      }
    } else if (top === "lore" || f.path.toLowerCase().endsWith(".md")) lore.push(f);
    // plotlines/foreshadows/anchors 等叙事域不在构建台预览模型内(无对应面板)，按 importPack 各归其域、不当 sheet 实体。
  }
  return { manifest, lore, rules, pools, fronts, entities: [...byEntity.values()] };
}

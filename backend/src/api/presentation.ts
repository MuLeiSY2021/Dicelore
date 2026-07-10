// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "@dicelore/interface";
import { buildPresentationModel } from "@dicelore/backend";
import {
  CLIENT_PROTOCOL,
  type PresentationChanges,
  type PresentationSnapshot,
  type SheetGroup,
  type PlotlineView,
  type ForeshadowView,
  type LoreView,
} from "@dicelore/shared";

// §7(A′) 玩家可见叙事投影：走 store/views.ts 的命名视图(防剧透过滤已在视图内做)。
// front 不下发(GM 工具)、plotline active+closed、foreshadow recalled 且 visible=1、lore visible=1。
function visiblePlotlines(db: DB): PlotlineView[] {
  return db
    .prepare("SELECT id, title, summary, status FROM plotline_visible ORDER BY id")
    .all() as PlotlineView[];
}
function visibleForeshadows(db: DB): ForeshadowView[] {
  return db
    .prepare("SELECT id, content, status FROM foreshadow_visible ORDER BY id")
    .all() as ForeshadowView[];
}
function visibleLore(db: DB): LoreView[] {
  return db
    .prepare("SELECT name, content, category FROM lore_visible ORDER BY name")
    .all() as LoreView[];
}

// core PresentationModel → 接口页 §1 线上快照。core 纯函数已按 visible 过滤(全为 visible=1)。
// spoiler-tiering §一.5：opts.includeHidden=true 时 sheets 改从 state 表全量取(含 visible=0，cell 带真实 visible)，
// 供 bay 关闭档「点 btn 按需拉」；offset/limit 对扁平 cell 列表(entity,attr 序)分页防卡。默认(不传)行为不变。
export function buildSnapshot(
  db: DB,
  sessionId: string,
  opts: { includeHidden?: boolean; offset?: number; limit?: number } = {},
): PresentationSnapshot {
  const model = buildPresentationModel(db, { turnStartSeq: 0 }); // 全量快照：取所有可见机械事实

  const groups = opts.includeHidden
    ? hiddenSheets(db, opts.offset ?? 0, opts.limit) // 全量含 visible=0（bay 按需拉 + 分页）
    : visibleSheets(model.statusMenu); // 默认：只投影 visible=1

  const choices = model.pendingChoice
    ? {
        eventId: model.pendingChoice.seq,
        options: model.pendingChoice.options.map((o, index) => ({
          index, label: o.label, consequence: o.consequence,
        })),
      }
    : null;

  return {
    protocol: CLIENT_PROTOCOL,
    sessionId,
    seq: maxSeq(db),
    sheets: groups,
    mechanics: model.mechanicalEcho.map((e) => ({ seq: e.seq, kind: e.kind, text: e.text })),
    choices,
    narrativeCursor: narrativeCursor(db),
    pendingRoll: null, // Phase 1：首屏不投影待掷(实时 roll_staged 经 WS;重启恢复见 recovery.ts)
    // §7(A′) 叙事层(RT-FE4)：dock-card dc-meta select 单源从快照取,不另起端点。
    plotlines: visiblePlotlines(db),
    foreshadows: visibleForeshadows(db),
    lore: visibleLore(db),
  };
}

// §7(A′) WS 呈现增量的叙事部分：把当前玩家可见叙事投影成 op=upsert 的局部增量。
// 缝 A 的 presentation_delta 只作信号(web 收到后 GET /presentation 全量对账)——故按可见集全量投 upsert，
// 让重连/局部刷新都能拿到 recalled 伏笔等叙事条目。空集则不产出对应字段(保持 changes 精简)。
export function buildNarrativeChanges(db: DB): PresentationChanges {
  const changes: PresentationChanges = {};
  const pl = visiblePlotlines(db);
  const fs = visibleForeshadows(db);
  const lo = visibleLore(db);
  if (pl.length) changes.plotlines = pl.map((p) => ({ ...p, op: "upsert" as const }));
  if (fs.length) changes.foreshadows = fs.map((f) => ({ ...f, op: "upsert" as const }));
  if (lo.length) changes.lore = lo.map((l) => ({ ...l, op: "upsert" as const }));
  return changes;
}

// statusMenu(VisibleCell[]) → 按 entity 分组、保序（全为 visible=1）。
function visibleSheets(statusMenu: { entity: string; attr: string; value: string }[]): SheetGroup[] {
  const groups: SheetGroup[] = [];
  const byEntity = new Map<string, SheetGroup>();
  for (const c of statusMenu) {
    let g = byEntity.get(c.entity);
    if (!g) { g = { entity: c.entity, cells: [] }; byEntity.set(c.entity, g); groups.push(g); }
    g.cells.push({ attr: c.attr, value: c.value, visible: 1 });
  }
  return groups;
}

// spoiler=关闭 按需拉：从 state 表全量取(不做 visible 截流，排除 __show_all 标记)、按 (entity,attr) 序扁平分页、再分组。
// 分页语义：offset/limit 切扁平 cell 列表；limit 省略=不分页(全量)。前端翻页至返回 < limit 即到底。
function hiddenSheets(db: DB, offset: number, limit?: number): SheetGroup[] {
  const sql =
    "SELECT entity, attr, value, visible FROM state WHERE attr != '__show_all' ORDER BY entity, attr" +
    (limit !== undefined ? " LIMIT ? OFFSET ?" : "");
  const rows = (limit !== undefined
    ? db.prepare(sql).all(limit, offset)
    : db.prepare(sql).all()) as { entity: string; attr: string; value: string; visible: number }[];
  const groups: SheetGroup[] = [];
  const byEntity = new Map<string, SheetGroup>();
  for (const r of rows) {
    let g = byEntity.get(r.entity);
    if (!g) { g = { entity: r.entity, cells: [] }; byEntity.set(r.entity, g); groups.push(g); }
    g.cells.push({ attr: r.attr, value: r.value, visible: r.visible });
  }
  return groups;
}
}

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  return r.s ?? 0;
}
function narrativeCursor(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM log WHERE kind='narrate'").get() as { s: number | null };
  return r.s ?? 0;
}

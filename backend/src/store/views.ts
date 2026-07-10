// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import { defineView } from "../toolgen/view.js";

// 叙事层 spec §4 的命名视图（零存储，按 kind+facet 投影 state 表）。
// 视图名 + 投影列 = 对下游 toolgen 读编译公开的稳定逻辑列契约。
const VIEW_DEFS: ReadonlyArray<readonly [name: string, sql: string]> = [
  ["player", "SELECT entity, attr, value, visible FROM state WHERE kind='player'"],
  ["npc", "SELECT entity, attr, value, visible FROM state WHERE kind='npc'"],
  ["world", "SELECT entity, attr, value, visible FROM state WHERE kind='world'"],
  [
    "relation",
    "SELECT entity, rel_object, rel_dim, value, visible FROM state WHERE rel_object IS NOT NULL",
  ],
  [
    "clock",
    "SELECT entity, attr, value, clock_min, clock_max, clock_mode FROM state WHERE clock_min IS NOT NULL OR clock_max IS NOT NULL",
  ],
  [
    "tension_board",
    `SELECT 'front' AS kind, id, name AS label, status FROM front WHERE status='active'
     UNION ALL
     SELECT 'plotline', id, title, status FROM plotline WHERE status IN ('open','active')
     UNION ALL
     SELECT 'foreshadow', id, content, status FROM foreshadow WHERE status='planted'
     UNION ALL
     SELECT 'watcher', CAST(id AS TEXT), condition, status FROM watcher WHERE armed=1`,
  ],
  // §7(A′) presentation 玩家可见叙事投影(防剧透·裁决 §7 C7/C8)。front 不投影(GM 工具)。
  // plotline：active+closed 下发(玩家已知主线走向)；foreshadow：recalled 且 visible=1；lore：visible=1。
  [
    "plotline_visible",
    "SELECT id, title, summary, status FROM plotline WHERE status IN ('active','closed')",
  ],
  [
    "foreshadow_visible",
    "SELECT id, content, status FROM foreshadow WHERE status='recalled' AND visible=1",
  ],
  ["lore_visible", "SELECT name, content, category FROM lore WHERE visible=1"],
];

/** 投影全部命名视图。幂等：先 DROP VIEW IF EXISTS 再 defineView（defineView 本身不幂等）。 */
export function initViews(db: DB): void {
  for (const [name, sql] of VIEW_DEFS) {
    db.exec(`DROP VIEW IF EXISTS ${name}`);
    defineView(db, name, sql);
  }
}

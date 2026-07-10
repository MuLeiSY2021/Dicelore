// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../db.js";

export interface Foreshadow {
  id: string;
  content: string;
  status: string;
  /** 可见性,与 status 正交:0 默认隐 / 1 已 show / 2 强制隐暗值。planted 剧透默认隐,GM show 才示玩家。 */
  visible: number;
}

export function foreshadowUpsert(db: DB, f: { id: string; content: string; status?: string }): void {
  // visible 不入 upsert:INSERT 走列默认 0、CONFLICT 更新不碰 visible(由 narrativeShow 独立管理)。
  db.prepare(
    `INSERT INTO foreshadow(id, content, status) VALUES(?,?,COALESCE(?,'planted'))
     ON CONFLICT(id) DO UPDATE SET content=excluded.content, status=excluded.status`
  ).run(f.id, f.content, f.status ?? null);
}

export function foreshadowGet(db: DB, id: string): Foreshadow | undefined {
  return db.prepare(`SELECT id, content, status, visible FROM foreshadow WHERE id = ?`).get(id) as Foreshadow | undefined;
}

export function foreshadowList(db: DB): Foreshadow[] {
  return db.prepare(`SELECT id, content, status, visible FROM foreshadow ORDER BY id`).all() as Foreshadow[];
}

export function foreshadowSetStatus(db: DB, id: string, status: string): void {
  db.prepare(`UPDATE foreshadow SET status = ? WHERE id = ?`).run(status, id);
}

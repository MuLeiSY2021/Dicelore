// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../db.js";
import { watcherList, type WatcherRow } from "./watcher.js";

export interface Front {
  id: string;
  name: string;
  stakes: string | null;
  clock_ref: string | null;
  status: string;
  /** 可见性,与 status 正交:0 默认隐 / 1 已 show / 2 强制隐暗值。front 全程 0(GM 工具不下发玩家)。 */
  visible: number;
}

export function frontUpsert(db: DB, f: { id: string; name: string; stakes?: string; clock_ref?: string; status?: string }): void {
  // visible 不入 upsert:INSERT 走列默认 0、CONFLICT 更新不碰 visible(由 narrativeShow 独立管理)。
  db.prepare(
    `INSERT INTO front(id, name, stakes, clock_ref, status) VALUES(?,?,?,?,COALESCE(?,'active'))
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, stakes=excluded.stakes, clock_ref=excluded.clock_ref, status=excluded.status`
  ).run(f.id, f.name, f.stakes ?? null, f.clock_ref ?? null, f.status ?? null);
}

export function frontGet(db: DB, id: string): Front | undefined {
  return db.prepare(`SELECT id, name, stakes, clock_ref, status, visible FROM front WHERE id = ?`).get(id) as Front | undefined;
}

export function frontList(db: DB): Front[] {
  return db.prepare(`SELECT id, name, stakes, clock_ref, status, visible FROM front ORDER BY id`).all() as Front[];
}

export function frontSetStatus(db: DB, id: string, status: string): void {
  db.prepare(`UPDATE front SET status = ? WHERE id = ?`).run(status, id);
}

export function frontOmenList(db: DB, frontId: string): WatcherRow[] {
  return watcherList(db).filter((w) => w.source === `front:${frontId}`);
}

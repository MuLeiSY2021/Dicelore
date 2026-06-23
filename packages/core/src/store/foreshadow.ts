// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export interface Foreshadow {
  id: string;
  content: string;
  status: string;
}

export function foreshadowUpsert(db: DB, f: { id: string; content: string; status?: string }): void {
  db.prepare(
    `INSERT INTO foreshadow(id, content, status) VALUES(?,?,COALESCE(?,'planted'))
     ON CONFLICT(id) DO UPDATE SET content=excluded.content, status=excluded.status`
  ).run(f.id, f.content, f.status ?? null);
}

export function foreshadowGet(db: DB, id: string): Foreshadow | undefined {
  return db.prepare(`SELECT id, content, status FROM foreshadow WHERE id = ?`).get(id) as Foreshadow | undefined;
}

export function foreshadowList(db: DB): Foreshadow[] {
  return db.prepare(`SELECT id, content, status FROM foreshadow ORDER BY id`).all() as Foreshadow[];
}

export function foreshadowSetStatus(db: DB, id: string, status: string): void {
  db.prepare(`UPDATE foreshadow SET status = ? WHERE id = ?`).run(status, id);
}

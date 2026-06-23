// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export interface Anchor {
  id: number;
  owner_table: string;
  owner_id: string;
  target_table: string;
  target_id: string;
  role: string | null;
}

const COLS = "id, owner_table, owner_id, target_table, target_id, role";

export function anchorAdd(
  db: DB,
  a: { owner_table: string; owner_id: string; target_table: string; target_id: string; role?: string },
): number {
  const info = db
    .prepare(`INSERT INTO anchor(owner_table, owner_id, target_table, target_id, role) VALUES(?,?,?,?,?)`)
    .run(a.owner_table, a.owner_id, a.target_table, a.target_id, a.role ?? null);
  return Number(info.lastInsertRowid);
}

export function anchorsByOwner(db: DB, owner_table: string, owner_id: string): Anchor[] {
  return db
    .prepare(`SELECT ${COLS} FROM anchor WHERE owner_table=? AND owner_id=? ORDER BY id`)
    .all(owner_table, owner_id) as Anchor[];
}

export function anchorsByTarget(db: DB, target_table: string, target_id: string): Anchor[] {
  return db
    .prepare(`SELECT ${COLS} FROM anchor WHERE target_table=? AND target_id=? ORDER BY id`)
    .all(target_table, target_id) as Anchor[];
}

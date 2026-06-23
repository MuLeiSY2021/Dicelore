// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export interface Plotline {
  id: string;
  title: string;
  summary: string | null;
  status: string;
}

export function plotlineUpsert(db: DB, p: { id: string; title: string; summary?: string; status?: string }): void {
  db.prepare(
    `INSERT INTO plotline(id, title, summary, status) VALUES(?,?,?,COALESCE(?,'open'))
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary, status=excluded.status`
  ).run(p.id, p.title, p.summary ?? null, p.status ?? null);
}

export function plotlineGet(db: DB, id: string): Plotline | undefined {
  return db.prepare(`SELECT id, title, summary, status FROM plotline WHERE id = ?`).get(id) as Plotline | undefined;
}

export function plotlineList(db: DB): Plotline[] {
  return db.prepare(`SELECT id, title, summary, status FROM plotline ORDER BY id`).all() as Plotline[];
}

export function plotlineSetStatus(db: DB, id: string, status: string): void {
  db.prepare(`UPDATE plotline SET status = ? WHERE id = ?`).run(status, id);
}

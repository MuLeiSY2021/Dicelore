// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export interface History {
  id: number;
  seq_from: number;
  seq_to: number;
  summary: string;
  created_seq: number;
}

export function historyAppend(
  db: DB,
  h: { seq_from: number; seq_to: number; summary: string; created_seq: number },
): number {
  const info = db
    .prepare(
      `INSERT INTO history(seq_from, seq_to, summary, created_seq) VALUES(?,?,?,?)`,
    )
    .run(h.seq_from, h.seq_to, h.summary, h.created_seq);
  return Number(info.lastInsertRowid);
}

export function historyList(db: DB): History[] {
  return db
    .prepare(`SELECT id, seq_from, seq_to, summary, created_seq FROM history ORDER BY id`)
    .all() as History[];
}

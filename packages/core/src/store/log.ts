// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import { escapeLike, ftsIndex, ftsSearch } from "./fts.js";

export type LogKind = "narrate" | "verdict" | "mutation" | "note" | "watcher_fired" | "reveal" | "choice";

export interface LogInput {
  content?: string;
  kind: LogKind;
  data_json?: unknown;
  tags?: string;
  visible?: number;
  game_time?: string;
  is_moment?: number;
}

export interface LogRow {
  seq: number;
  content: string | null;
  kind: LogKind;
  data_json: string | null;
  tags: string | null;
  visible: number;
  game_time: string | null;
  is_moment: number;
  created_at: string;
}

function defaultVisible(kind: LogKind): number {
  return kind === "note" ? 0 : 1;
}

export function logAppend(db: DB, ev: LogInput): number {
  const visible = ev.visible ?? defaultVisible(ev.kind);
  const info = db
    .prepare(
      "INSERT INTO log (content, kind, data_json, tags, visible, game_time, is_moment) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      ev.content ?? null,
      ev.kind,
      ev.data_json === undefined ? null : JSON.stringify(ev.data_json),
      ev.tags ?? null,
      visible,
      ev.game_time ?? null,
      ev.is_moment ?? 0,
    );
  const seq = Number(info.lastInsertRowid);
  if (ev.content && ev.content.trim()) ftsIndex(db, "log_fts", seq, ev.content);
  return seq;
}

export function logSince(db: DB, sinceSeq: number): LogRow[] {
  return db.prepare("SELECT * FROM log WHERE seq > ? ORDER BY seq").all(sinceSeq) as LogRow[];
}

// FTS 召回 + tag LIKE 兜底。当前分支 seq 过滤由快照线/adapter 在上层接(§4.5.3),本层返回全量命中。
export function logRecall(db: DB, query: string, opts: { limit?: number } = {}): LogRow[] {
  const limit = opts.limit ?? 20;
  const seqs = new Set<number>(ftsSearch(db, "log_fts", query, limit).map((h) => h.rowid));
  const tagRows = db
    .prepare("SELECT seq FROM log WHERE tags LIKE ? ESCAPE '\\' LIMIT ?")
    .all(`%${escapeLike(query)}%`, limit) as { seq: number }[];
  for (const r of tagRows) seqs.add(r.seq);
  if (seqs.size === 0) return [];
  const ids = [...seqs];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM log WHERE seq IN (${placeholders}) ORDER BY seq`).all(...ids) as LogRow[];
}

import type { DB } from "./db.js";
import { escapeLike, ftsIndex, ftsSearch } from "./fts.js";

export type EventKind = "narrate" | "verdict" | "mutation" | "note" | "watcher_fired" | "reveal" | "choice";

export interface EventInput {
  content?: string;
  kind: EventKind;
  data_json?: unknown;
  tags?: string;
  visible?: number;
  game_time?: string;
}

export interface EventRow {
  seq: number;
  content: string | null;
  kind: EventKind;
  data_json: string | null;
  tags: string | null;
  visible: number;
  game_time: string | null;
  created_at: string;
}

function defaultVisible(kind: EventKind): number {
  return kind === "note" ? 0 : 1;
}

export function eventAppend(db: DB, ev: EventInput): number {
  const visible = ev.visible ?? defaultVisible(ev.kind);
  const info = db
    .prepare(
      "INSERT INTO event (content, kind, data_json, tags, visible, game_time) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      ev.content ?? null,
      ev.kind,
      ev.data_json === undefined ? null : JSON.stringify(ev.data_json),
      ev.tags ?? null,
      visible,
      ev.game_time ?? null,
    );
  const seq = Number(info.lastInsertRowid);
  if (ev.content && ev.content.trim()) ftsIndex(db, "event_fts", seq, ev.content);
  return seq;
}

export function eventSince(db: DB, sinceSeq: number): EventRow[] {
  return db.prepare("SELECT * FROM event WHERE seq > ? ORDER BY seq").all(sinceSeq) as EventRow[];
}

// FTS 召回 + tag LIKE 兜底。当前分支 seq 过滤由快照线/adapter 在上层接(§4.5.3),本层返回全量命中。
export function eventRecall(db: DB, query: string, opts: { limit?: number } = {}): EventRow[] {
  const limit = opts.limit ?? 20;
  const seqs = new Set<number>(ftsSearch(db, "event_fts", query, limit).map((h) => h.rowid));
  const tagRows = db
    .prepare("SELECT seq FROM event WHERE tags LIKE ? ESCAPE '\\' LIMIT ?")
    .all(`%${escapeLike(query)}%`, limit) as { seq: number }[];
  for (const r of tagRows) seqs.add(r.seq);
  if (seqs.size === 0) return [];
  const ids = [...seqs];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM event WHERE seq IN (${placeholders}) ORDER BY seq`).all(...ids) as EventRow[];
}

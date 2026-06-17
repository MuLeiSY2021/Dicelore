import type { DB } from "./db.js";

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
  return Number(info.lastInsertRowid);
}

export function eventSince(db: DB, sinceSeq: number): EventRow[] {
  return db.prepare("SELECT * FROM event WHERE seq > ? ORDER BY seq").all(sinceSeq) as EventRow[];
}

import { evalPredicate, type EvalCtx } from "../expr/predicate.js";
import { eventAppend } from "./event.js";
import type { DB } from "./db.js";

export interface WatcherRow {
  id: number;
  condition: string;
  payload: string;
  mode: "once" | "repeat";
  armed: number;
  status: string;
}

export function watcherSet(
  db: DB,
  opts: { condition: string; payload: string; mode?: "once" | "repeat"; created_seq?: number },
): number {
  const info = db
    .prepare(
      "INSERT INTO watcher (created_seq, condition, payload, mode, armed, status) VALUES (?, ?, ?, ?, 1, 'active')",
    )
    .run(opts.created_seq ?? null, opts.condition, opts.payload, opts.mode ?? "once");
  return Number(info.lastInsertRowid);
}

export function watcherList(db: DB): WatcherRow[] {
  return db.prepare("SELECT * FROM watcher WHERE status='active'").all() as WatcherRow[];
}

// edge-triggered:armed∧cond→触发；¬armed∧¬cond∧repeat→re-arm。
export function recomputeWatchers(db: DB, ctx: EvalCtx): { id: number; payload: string }[] {
  const fired: { id: number; payload: string }[] = [];
  for (const w of watcherList(db)) {
    const cond = evalPredicate(w.condition, ctx);
    if (w.armed === 1 && cond) {
      const seq = eventAppend(db, { kind: "watcher_fired", content: w.payload, data_json: { watcher_id: w.id } });
      if (w.mode === "once") {
        db.prepare("UPDATE watcher SET armed=0, last_fired_seq=?, status='fired' WHERE id=?").run(seq, w.id);
      } else {
        db.prepare("UPDATE watcher SET armed=0, last_fired_seq=? WHERE id=?").run(seq, w.id);
      }
      fired.push({ id: w.id, payload: w.payload });
    } else if (w.armed === 0 && !cond && w.mode === "repeat") {
      db.prepare("UPDATE watcher SET armed=1 WHERE id=?").run(w.id);
    }
  }
  return fired;
}

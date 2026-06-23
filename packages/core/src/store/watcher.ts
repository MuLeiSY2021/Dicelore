// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { evalPredicate } from "../expr/predicate.js";
import type { EvalCtx } from "../expr/evaluate.js";
import { logAppend } from "./log.js";
import { makeExistsMatch } from "./existsMatch.js";
import type { DB } from "./db.js";

export interface WatcherRow {
  id: number;
  condition: string;
  payload: string;
  mode: "once" | "repeat";
  armed: number;
  status: string;
  source: string;
  last_fired_seq: number | null;
}

export function watcherSet(
  db: DB,
  opts: { condition: string; payload: string; mode?: "once" | "repeat"; created_seq?: number; source?: string },
): number {
  const info = db
    .prepare(
      "INSERT INTO watcher (created_seq, condition, payload, mode, armed, status, source) VALUES (?, ?, ?, ?, 1, 'active', ?)",
    )
    .run(opts.created_seq ?? null, opts.condition, opts.payload, opts.mode ?? "once", opts.source ?? "manual");
  return Number(info.lastInsertRowid);
}

export function watcherList(db: DB): WatcherRow[] {
  return db.prepare("SELECT id, condition, payload, mode, armed, status, source, last_fired_seq FROM watcher WHERE status='active'").all() as WatcherRow[];
}

// edge-triggered:armed∧cond→触发；¬armed∧¬cond∧repeat→re-arm。
// repeat watcher 已触发过时(last_fired_seq 非空),log 类匹配注入 since 游标,
// 只认比上次触发更新的 log 事件,避免同一 log 行重复触发。
export function recomputeWatchers(db: DB, ctx: EvalCtx): { id: number; payload: string }[] {
  const baseExists = ctx.existsMatch ?? makeExistsMatch(db);
  const fired: { id: number; payload: string }[] = [];
  for (const w of watcherList(db)) {
    // 为 repeat 且已触发过的 watcher 注入 since 游标
    const since = w.mode === "repeat" && w.last_fired_seq != null ? w.last_fired_seq : undefined;
    const wctx: EvalCtx = {
      ...ctx,
      existsMatch: (ns, conds, sinceArg) => baseExists(ns, conds, sinceArg ?? since),
    };
    const cond = evalPredicate(w.condition, wctx);
    if (w.armed === 1 && cond) {
      const seq = logAppend(db, { kind: "watcher_fired", content: w.payload, data_json: { watcher_id: w.id } });
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


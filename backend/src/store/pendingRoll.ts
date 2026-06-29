// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

// RollShape / RollSpec / PendingRollRow 定义下沉 @dicelore/interface(SessionBackend 方法面引用)；re-export 保持公共面。
import type { RollShape, RollSpec, PendingRollRow } from "@dicelore/interface";
export type { RollShape, RollSpec, PendingRollRow };

// 暂存明骰规格(无结果),返回自增 event_id 作客户端句柄(契约 pendingRoll.eventId / POST /roll {eventId})。
export function stagePendingRoll(db: DB, input: { shape: RollShape; spec: RollSpec }): number {
  const info = db
    .prepare("INSERT INTO pending_roll (shape, spec_json, status) VALUES (?, ?, 'awaiting')")
    .run(input.shape, JSON.stringify(input.spec));
  return Number(info.lastInsertRowid);
}

export function getPendingRoll(db: DB, eventId: number): PendingRollRow | undefined {
  const row = db
    .prepare("SELECT event_id, shape, spec_json, status, verdict_seq FROM pending_roll WHERE event_id=?")
    .get(eventId) as
    | { event_id: number; shape: RollShape; spec_json: string; status: "awaiting" | "committed"; verdict_seq: number | null }
    | undefined;
  if (!row) return undefined;
  return {
    eventId: row.event_id,
    shape: row.shape,
    spec: JSON.parse(row.spec_json) as RollSpec,
    status: row.status,
    verdictSeq: row.verdict_seq,
  };
}

export function markRollCommitted(db: DB, eventId: number, verdictSeq: number): void {
  db.prepare("UPDATE pending_roll SET status='committed', verdict_seq=? WHERE event_id=?").run(verdictSeq, eventId);
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { getPendingRoll, type DB, type RollGate, type PendingRollRow } from "@dicelore/core";
import { CLIENT_PROTOCOL, type PendingRoll, type StreamMessage } from "@dicelore/shared";
import type { WsHub } from "../pkg/wsHub.js";

// core PendingRollRow.spec → 线上 PendingRoll(只含规格,无结果)。
function toPendingRoll(row: PendingRollRow): PendingRoll {
  const s = row.spec;
  if (row.shape === "outcome") {
    return {
      eventId: row.eventId, shape: "outcome", label: s.context,
      yourSide: { name: "你", exprDisplay: s.die ?? "" },
      bands: (s.bands as { label?: string; min: number; max: number }[] | undefined ?? [])
        .map((b) => ({ label: b.label ?? "", min: b.min, max: b.max })),
    };
  }
  const a = s.a as { name?: string; expr?: string } | undefined;
  const b = s.b as { expr?: string } | undefined;
  const dc = Number(b?.expr);
  return {
    eventId: row.eventId, shape: "contest", label: s.context,
    yourSide: { name: a?.name ?? "你", exprDisplay: a?.expr ?? "" },
    dc: Number.isFinite(dc) ? dc : undefined,
  };
}

// 单人明骰 gate：core handler await gate(eventId) 时弹 roll_staged + 挂起;POST /roll → resolveRoll 解开。
export class PlayerRollGate {
  private waiters = new Map<number, () => void>();
  constructor(private db: DB, private hub: WsHub, private sessionId: string) {}

  gate: RollGate = (eventId: number) =>
    new Promise<void>((resolve) => {
      const spec = this.pendingSpec(eventId);
      if (spec) {
        const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "roll_staged", pendingRoll: spec };
        this.hub.broadcast(this.sessionId, msg);
      }
      this.waiters.set(eventId, resolve);
    });

  resolveRoll(eventId: number): boolean {
    const w = this.waiters.get(eventId);
    if (!w) return false;
    this.waiters.delete(eventId);
    w();
    return true;
  }

  pendingSpec(eventId: number): PendingRoll | null {
    const row = getPendingRoll(this.db, eventId);
    return row ? toPendingRoll(row) : null;
  }
}

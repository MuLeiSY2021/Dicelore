// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionBackend, PendingRollRow, RollResult } from "@dicelore/interface";
import type { RollGate } from "./mcp/rollGate.js";
import { CLIENT_PROTOCOL, type PendingRoll, type StreamMessage } from "@dicelore/shared";
import type { WsHub } from "../runtime/wsHub.js";

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
  constructor(private backend: SessionBackend, private hub: WsHub, private sessionId: string) {}

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
    if (w) {
      // 常态:in-flight turn 的 core handler 正 await gate(eventId) → 解开它,handler 续跑 commitPendingRoll
      // 并经 onCanonWrite 广播 roll_committed(缝 A 单一映射器)。
      this.waiters.delete(eventId);
      w();
      return true;
    }
    // RT-3 重启死锁修复：无 waiter，但库里可能仍有此 eventId 的 pending_roll。
    // 进程重启会丢失 in-flight turn(连同 await gate 的续体)与内存 waiters，但 pending_roll 行仍在库里 awaiting。
    // 此时玩家点掷骰若仅靠 waiter 解锁，resolveRoll 返回 false → 端点 409 → verdict 永不落、卡死。
    // 续体已不可重建(turn loop 不在跑，重建 waiter 解开也无人接)，故走「无 gate 立即掷」分支：
    // 由会话层直接 commitPendingRoll(掷骰+落 verdict)并广播 roll_committed——这正是被丢失的 handler 本该做的活。
    // commitPendingRoll 幂等(已 committed 据 verdict 重建不重掷)，故重启后玩家重复点击/WS 重发也安全。
    const pr = this.backend.getPendingRoll(eventId);
    if (!pr) return false; // 未知 eventId(或非本会话)——端点据此回 409 no_pending_roll，语义正确。
    const r = this.backend.commitPendingRoll(eventId);
    this.broadcastCommitted(r);
    return true;
  }

  // 重启恢复路的 roll_committed 广播:对齐 notify.mapCanonWrite 对 resolve_*_open 的映射口径
  // (eventId=verdictSeq、rolls/total/dc/outcome)。常态由 core onCanonWrite 发，这里是会话层自行补发。
  private broadcastCommitted(r: RollResult): void {
    const msg: StreamMessage =
      r.shape === "outcome"
        ? {
            protocol: CLIENT_PROTOCOL, type: "roll_committed",
            eventId: r.verdictSeq, rolls: [r.roll], total: r.roll, outcome: r.band.label,
          }
        : {
            protocol: CLIENT_PROTOCOL, type: "roll_committed",
            eventId: r.verdictSeq,
            rolls: [...r.a.rolls, ...r.b.rolls], total: r.a.total, dc: r.b.total,
            outcome: r.winner === "a" ? "success" : r.winner === "b" ? "fail" : "tie",
          };
    this.hub.broadcast(this.sessionId, msg);
  }

  pendingSpec(eventId: number): PendingRoll | null {
    const row = this.backend.getPendingRoll(eventId);
    return row ? toPendingRoll(row) : null;
  }
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import { logSince, type DB } from "@dicelore/core";
import type { PlayerRollGate } from "./rollGate.js";
import type { WsHub } from "../pkg/wsHub.js";

// 宕机恢复：扫描 awaiting 的 pending_roll → 重弹 roll_staged(玩家重连重掷)。返回重弹数。
// (重驱 GM 的非阻塞喂回属 DiceSession.handleRoll fallback,本函数只负责重弹卡。)
export function restagePendingRolls(host: { db: DB; gate: PlayerRollGate; hub: WsHub; sessionId: string }): number {
  const rows = host.db.prepare("SELECT event_id FROM pending_roll WHERE status='awaiting'").all() as { event_id: number }[];
  let n = 0;
  for (const r of rows) {
    const spec = host.gate.pendingSpec(r.event_id);
    if (!spec) continue;
    const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "roll_staged", pendingRoll: spec };
    host.hub.broadcast(host.sessionId, msg);
    n += 1;
  }
  return n;
}

// B2：重连补叙述历史——把 since(= 客户端 narrativeCursor)之后的 kind=narrate event
// 按全局 seq 重发为 narration_commit(对齐快照 narrativeCursor 去重口径,接口页 §2/§3+4 注⑥)。
// 返回补发条数。配套端点 GET /sessions/:id/events?since= 供客户端主动拉取;本函数是服务端重连推齐路径。
export function replayNarration(host: { db: DB; hub: WsHub; sessionId: string }, since: number): number {
  const rows = logSince(host.db, since).filter((r) => r.kind === "narrate" && r.visible === 1);
  for (const r of rows) {
    host.hub.broadcast(host.sessionId, {
      protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: r.seq, text: r.content ?? "",
    });
  }
  return rows.length;
}

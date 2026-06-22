// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { StreamMessage } from "@dicelore/shared";

export interface WsLike { send(data: string): void; readyState: number }
const OPEN = 1;

// 每 session 一组 WS 连接 + JSON 广播。不串台、跳过非 OPEN。
export class WsHub {
  private bySession = new Map<string, Set<WsLike>>();
  add(sessionId: string, ws: WsLike): void {
    let set = this.bySession.get(sessionId);
    if (!set) { set = new Set(); this.bySession.set(sessionId, set); }
    set.add(ws);
  }
  remove(sessionId: string, ws: WsLike): void {
    this.bySession.get(sessionId)?.delete(ws);
  }
  broadcast(sessionId: string, msg: StreamMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.bySession.get(sessionId) ?? []) {
      if (ws.readyState === OPEN) ws.send(data);
    }
  }
}

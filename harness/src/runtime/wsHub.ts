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
// 泛型 M 为广播的消息类型：默认 StreamMessage（dicegm 域）；loregm 域用 WsHub<LoreStreamMessage>——
// 两 kind 共用同一 WS 骨架、消息枚举不同（loregm-ws 裁决 §二 C1/C5）。
export class WsHub<M = StreamMessage> {
  private bySession = new Map<string, Set<WsLike>>();
  add(sessionId: string, ws: WsLike): void {
    let set = this.bySession.get(sessionId);
    if (!set) { set = new Set(); this.bySession.set(sessionId, set); }
    set.add(ws);
  }
  remove(sessionId: string, ws: WsLike): void {
    this.bySession.get(sessionId)?.delete(ws);
  }
  broadcast(sessionId: string, msg: M): void {
    const data = JSON.stringify(msg);
    for (const ws of this.bySession.get(sessionId) ?? []) {
      if (ws.readyState === OPEN) ws.send(data);
    }
  }
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { Session } from "./session.js";

// 会话注册表：多租户/跨机接入点。构造 path-specific 会话由调用方经 create 回调做，
// 注册表本身 path-agnostic(不 import 任何路径实现)。P1 只 InMemory 单机实现。
export interface SessionRegistry<S extends Session = Session> {
  getOrCreate(sessionId: string, create: () => S): S;
  get(sessionId: string): S | undefined;
  remove(sessionId: string): void;
}

export class InMemorySessionRegistry<S extends Session = Session> implements SessionRegistry<S> {
  private map = new Map<string, S>();
  getOrCreate(sessionId: string, create: () => S): S {
    let s = this.map.get(sessionId);
    if (!s) { s = create(); this.map.set(sessionId, s); }
    return s;
  }
  get(sessionId: string): S | undefined { return this.map.get(sessionId); }
  remove(sessionId: string): void { this.map.delete(sessionId); }
}

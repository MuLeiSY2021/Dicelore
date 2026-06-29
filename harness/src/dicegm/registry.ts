// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { InMemorySessionRegistry } from "../runtime/registry.js";
import { getLogger } from "@dicelore/logs";
import { DiceSession, type DiceSessionDeps } from "./DiceSession.js";

// dice 跑团会话单例注册表(背靠泛型 InMemory 实现)。签名同原,server 调用方不变。
const registry = new InMemorySessionRegistry<DiceSession>();

export function getOrCreateHost(sessionId: string, deps: DiceSessionDeps): DiceSession {
  return registry.getOrCreate(sessionId, () => {
    // 首次为该会话建内存 host(进程内单例);重连/后续请求命中 cache 不触发此分支。
    getLogger().info({ sessionId }, "新建会话 host(内存注册表)");
    return new DiceSession(sessionId, deps);
  });
}
export function getHost(sessionId: string): DiceSession | undefined { return registry.get(sessionId); }
export function removeHost(sessionId: string): void {
  getLogger().info({ sessionId }, "注销会话 host(内存注册表)");
  registry.remove(sessionId);
}

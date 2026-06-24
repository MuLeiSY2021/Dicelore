// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { InMemorySessionRegistry } from "../pkg/registry.js";
import { DiceSession, type DiceSessionDeps } from "./DiceSession.js";

// dice 跑团会话单例注册表(背靠泛型 InMemory 实现)。签名同原,server 调用方不变。
const registry = new InMemorySessionRegistry<DiceSession>();

export function getOrCreateHost(sessionId: string, deps: DiceSessionDeps): DiceSession {
  return registry.getOrCreate(sessionId, () => new DiceSession(sessionId, deps));
}
export function getHost(sessionId: string): DiceSession | undefined { return registry.get(sessionId); }
export function removeHost(sessionId: string): void { registry.remove(sessionId); }

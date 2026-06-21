// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { SessionHost, type SessionHostDeps } from "./SessionHost.js";

const hosts = new Map<string, SessionHost>();

export function getOrCreateHost(sessionId: string, deps: SessionHostDeps): SessionHost {
  let h = hosts.get(sessionId);
  if (!h) { h = new SessionHost(sessionId, deps); hosts.set(sessionId, h); }
  return h;
}
export function getHost(sessionId: string): SessionHost | undefined { return hosts.get(sessionId); }

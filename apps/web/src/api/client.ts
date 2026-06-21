// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PresentationSnapshot, SessionSummary } from "@dicelore/shared";

// 只读：取全量呈现快照(接口页 §2 GET /sessions/:id/presentation)。增量 WS 仍阻塞。
export async function getPresentation(sessionId: string): Promise<PresentationSnapshot> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/presentation`);
  if (!res.ok) throw new Error(`presentation 请求失败：${res.status}`);
  return (await res.json()) as PresentationSnapshot;
}

// 会话列表(主页继续上次 / 最近 Session)。
export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/sessions");
  if (!res.ok) throw new Error(`sessions 请求失败：${res.status}`);
  return ((await res.json()) as { sessions: SessionSummary[] }).sessions;
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 构建域 HTTP：显式建构建会话(POST /sessions/loregm) + 构建助手对话(POST /sessions/loregm/:id/messages)。

import { apiError } from "@/shared/api/http.js";

// 显式建构建会话(session-surface-flatten §三)：POST /sessions/loregm {name?} → 201 {sessionId, kind}。
// 服务端生成 sessionId、建 Draft + 构建 MCP。取代首访懒建(C2 移除)。返回 sessionId 供后续 message/draft。
export async function createLoreSession(name?: string): Promise<string> {
  const res = await fetch("/sessions/loregm", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(name === undefined ? {} : { name }),
  });
  if (!res.ok) throw await apiError(res, "create lore session");
  return ((await res.json()) as { sessionId: string }).sessionId;
}

// 构建助手对话(POST /sessions/loregm/:id/messages)。会话须先经 createLoreSession 显式建。
export async function postBuildMessage(loreSessionId: string, text: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/loregm/${encodeURIComponent(loreSessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await apiError(res, "build message");
  return (await res.json()) as { turnId: string };
}

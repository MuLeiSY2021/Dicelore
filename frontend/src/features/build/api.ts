// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 构建域 HTTP：构建助手对话(POST /lore-sessions/:id/messages)。

import { apiError } from "@/shared/api/http.js";

// 构建助手对话(POST /lore-sessions/:id/messages)。
export async function postBuildMessage(loreSessionId: string, text: string, name: string): Promise<{ turnId: string }> {
  const res = await fetch(`/lore-sessions/${encodeURIComponent(loreSessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, name }),
  });
  if (!res.ok) throw await apiError(res, "build message");
  return (await res.json()) as { turnId: string };
}

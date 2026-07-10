// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { openDb, metaGet } from "@dicelore/backend";
import { getLogger } from "@dicelore/logs";
import type { SessionSummary, SessionKind } from "@dicelore/shared";

// 枚举 dir 下的 session 子目录(每子目录 = 一个自包含 session 文件夹),开其 session.db 读 session_meta → 摘要。
// 统一形状(session-surface-flatten §6)：kind 由调用方按目录传入(dicegm/loregm);title = sessionId(=子目录名);
// packName = 团本名(session_meta「adventure_name」,无则以 sessionId 兜底——C3 不可空);started = 是否已 kickoff;
// lastActionAt = session.db mtime。目录不可读 → []。
// catalog.db 在 dicelore/ 下而非 sessions/,无需排除。前端渲染格式: packName + " · " + title。
export function listSessionSummaries(dir: string, kind: SessionKind): SessionSummary[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (e) {
    getLogger().warn({ err: e, dir }, "sessions 目录不可读,返回空列表");
    return [];
  }
  return entries
    .filter((f) => { try { return statSync(join(dir, f)).isDirectory(); } catch (e) { getLogger().warn({ err: e, entry: f }, "stat 子条目失败,跳过"); return false; } })
    .sort()
    .map((sub) => {
      const sessionId = sub;
      const path = join(dir, sub, "session.db");
      const title = sessionId;
      let packName: string | undefined;
      let started: boolean | undefined;
      let lastActionAt: number | undefined;
      try {
        const db = openDb(path);
        const name = metaGet(db, "adventure_name");
        if (name) packName = name;
        started = metaGet(db, "started") === "1";
        db.close();
      } catch (e) {
        getLogger().warn({ err: e, path }, "读 session_meta 失败,裸 id 兜底");
      }
      try { lastActionAt = statSync(path).mtimeMs; } catch (e) {
        getLogger().warn({ err: e, path }, "stat session.db mtime 失败");
      }
      // packName 不可空(C3)：无团本名则以 sessionId 兜底,保证字段恒有值。
      return { sessionId, kind, title, status: "active" as const, packName: packName ?? sessionId, started, lastActionAt };
    });
}

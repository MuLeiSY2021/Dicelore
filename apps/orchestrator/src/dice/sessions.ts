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
import { openDb, metaGet } from "@dicelore/core";
import type { SessionSummary } from "@dicelore/shared";

// 枚举 dir 下的 *.db(排除 catalog.db),开每库读 session_meta → 摘要。
// title = 团本名(前缀,无则裸 sessionId);updatedAt = 文件 mtime。目录不可读 → []。
export function listSessionSummaries(dir: string): SessionSummary[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".db") && f !== "catalog.db")
    .sort()
    .map((f) => {
      const sessionId = f.slice(0, -".db".length);
      const path = join(dir, f);
      let title = sessionId;
      let updatedAt: number | undefined;
      try {
        const db = openDb(path);
        const name = metaGet(db, "tuanben_name");
        if (name) title = name;
        db.close();
      } catch { /* 读不动(非法库/无 meta)→ 裸 id */ }
      try { updatedAt = statSync(path).mtimeMs; } catch { /* ignore */ }
      return { sessionId, title, status: "active" as const, updatedAt };
    });
}

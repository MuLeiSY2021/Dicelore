// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../db.js";

// 记忆工具写原语（A′ §6）：标某条 log 为「关键时刻」。
// GM 手动标（mark_moment 工具），history_compact 压缩时优先保留 moment、recall 优先召回 moment。
// 与叙事表 setStatus / state mutate 并列，是 toolgen writeMatch 认得的正典写原语之一——
// 声明式工具永不裸跑 SQL，只路由到此。
// 返回受影响行数（seq 不存在时为 0，供上层判定/日志）。
export function markMoment(db: DB, seq: number): number {
  const info = db.prepare("UPDATE log SET is_moment = 1 WHERE seq = ?").run(seq);
  return info.changes;
}

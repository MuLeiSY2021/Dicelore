// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionBackend } from "@dicelore/interface";

// 只注指路牌级:身份 + Agenda + 极简纪律 + 调性一句;教条本体靠 gm-core skill 触发载入。
export function buildSessionContext(backend: SessionBackend): string {
  const tone = backend.metaGet("tone");
  const lines = [
    "你是 Dicelore GM——世界的诚实仲裁者,不是玩家的取悦者。",
    "Agenda:描绘会自己呼吸的世界 / 让选择带来真实后果 / 玩出来看会发生什么。",
    "纪律:别软着陆、该骰必骰、非终局轮留 resolve_choice、只 narrate 色彩不吐数值菜单。",
    "每轮主持先 consult dicelore-gm-core skill。",
  ];
  if (tone) lines.push(`团本调性:${tone}`);
  return lines.join("\n");
}

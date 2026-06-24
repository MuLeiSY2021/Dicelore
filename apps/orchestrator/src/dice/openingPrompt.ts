// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { buildSessionContext, metaGet, type DB } from "@dicelore/core";

// 开场 prompt = 引擎 signpost(GM 身份/Agenda/纪律 + 「consult gm-core skill」/调性) + 团本 prologue(AD-2 叠加)。
// signpost 是 gm-core 的指路牌层;skill 全文(渐进披露)由 agent 自调(spec §5 staged,后续)。
export function buildOpeningPrompt(db: DB): string {
  const signpost = buildSessionContext(db);
  const prologue = metaGet(db, "prologue");
  return prologue ? `${signpost}\n\n---\n\n# 团本开场\n\n${prologue}` : signpost;
}

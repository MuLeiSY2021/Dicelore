// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

export type SessionKind = "dice" | "lore";

// 运行单元最小身份契约。生命周期(start/stop)待跨机/lore 实现需要时扩(spec §7.3)。
export interface Session {
  readonly sessionId: string;
  readonly kind: SessionKind;
}

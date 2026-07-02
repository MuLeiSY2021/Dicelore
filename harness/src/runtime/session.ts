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

// handleMessage 一轮的返回。error 可选、领域级(GM 中途出错;非传输级):
// lore 侧(BE-lore-error-shape)驱动 agent 产 error 事件时填 { message, code? }、不吞;
// dice 侧不产该字段(其 handleMessage 返回结构上是 TurnResult 的子类型、零影响)。
// handleMessage 未挂进 Session 接口(仅 DiceSession/LoreSession 各自实现),此类型作跨实现的共享返回契约。
export interface TurnResult {
  turnId: string;
  error?: { message: string; code?: string };
}

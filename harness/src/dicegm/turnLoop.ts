// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "@dicelore/interface";
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { Agent, TurnInput, TurnUsage } from "../runtime/agent.js";
import type { WsHub } from "../runtime/wsHub.js";
import { streamDriverTurn } from "../runtime/streamTurn.js";

export interface TurnEndResult {
  choices?: { eventId: number; options: { index: number; label: string; consequence: string }[] };
}
export interface RunTurnDeps {
  db: DB;
  driver: Agent;
  hub: WsHub;
  sessionId: string;
  turnId: string;
  runTurnEnd: (db: DB) => TurnEndResult;
  onUsage?: (usage: TurnUsage, model?: string) => void; // 透传给 streamDriverTurn:agent usage 事件→会话经端口落库
}

// 跑团回合：流式产出(streamDriverTurn,pkg 共享)→ 回合末跑 turn-end hook → choices/turn_ended。
// 呈现增量(presentation_delta)由 onCanonWrite 经 DiceSession→hub 异步发出,不在此处。
// B4：turn_ended.seq 取「全局 log event seq」(MAX(seq))而非 streamDriverTurn 的回合内计数器,
// 与 §1 快照 narrativeCursor 同口径,重连去重才可靠(narration_commit.seq 现由 onCanonWrite 用 evt.seq 全局对齐)。
export async function runTurn(deps: RunTurnDeps, input: TurnInput): Promise<void> {
  const { errored } = await streamDriverTurn(deps, input);
  if (errored) return;
  const send = (m: StreamMessage) => deps.hub.broadcast(deps.sessionId, m);
  const res = deps.runTurnEnd(deps.db);
  if (res.choices) send({ protocol: CLIENT_PROTOCOL, type: "choices", choices: res.choices });
  const r = deps.db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  send({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: deps.turnId, seq: r.s ?? 0 });
}

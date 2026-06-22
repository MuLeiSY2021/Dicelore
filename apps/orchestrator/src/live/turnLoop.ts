// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "@dicelore/core";
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { Agent, TurnInput } from "../pkg/agent.js";
import type { WsHub } from "../pkg/wsHub.js";

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
}

// 消费 GmDriver 事件流 → 广播 narration/error/turn 生命周期；回合末跑 turn-end hook → choices。
// 呈现增量(presentation_delta)由 onCanonWrite 经 SessionHost→hub 异步发出,不在此处。
export async function runTurn(deps: RunTurnDeps, input: TurnInput): Promise<void> {
  const { hub, sessionId, turnId } = deps;
  const send = (m: StreamMessage) => hub.broadcast(sessionId, m);
  send({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });

  let seq = 0;
  try {
    for await (const ev of deps.driver.runTurn(input)) {
      if (ev.type === "narration") {
        seq += 1;
        send({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq, text: ev.text });
      } else if (ev.type === "error") {
        send({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: ev.message });
        return;
      } else if (ev.type === "turn_end") {
        break;
      }
    }
  } catch (e) {
    send({ protocol: CLIENT_PROTOCOL, type: "error", code: "driver_error", message: e instanceof Error ? e.message : String(e) });
    return;
  }

  const res = deps.runTurnEnd(deps.db);
  if (res.choices) send({ protocol: CLIENT_PROTOCOL, type: "choices", choices: res.choices });
  send({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId, seq });
}

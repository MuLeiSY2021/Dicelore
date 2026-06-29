// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { CanonWriteEvent } from "./mcp/server.js";

// 缝 A 单一映射器(接口页 §5.1)：按 CanonWriteEvent.kind 显式分发成客户端流消息。
// 三流单源：narrate→narration_commit(流③叙事)、明骰→roll_committed、game_end→game_end、
// 其余规范态写→presentation_delta(流②呈现增量；web 收到后 GET /presentation 全量对账，注⑦)。
// narrate 的 text 由 DiceSession 从 log 行按 evt.seq 取出、注入 output.content(见 DiceSession.onCanonWrite)。
export function mapCanonWrite(evt: CanonWriteEvent): StreamMessage | null {
  switch (evt.kind) {
    case "game_end": {
      // B3：终局信号 → game_end 消息(前端 setGameEnd → 终局画面)。
      const o = (evt.output ?? {}) as { reason?: string; outcome?: string };
      return {
        protocol: CLIENT_PROTOCOL, type: "game_end",
        reason: o.reason ?? "", outcome: o.outcome ?? "",
      };
    }
    case "event": {
      // kind=event 下三个工具语义不同，按 toolName 细分：
      // - narrate → narration_commit(流③叙事单源)；
      // - resolve_*_open(明骰) → roll_committed；
      // - 其余(event_append/暗骰 verdict) → presentation_delta(机械回显)。
      if (evt.toolName === "narrate") {
        const content = (evt.output as { content?: unknown } | null)?.content;
        return {
          protocol: CLIENT_PROTOCOL, type: "narration_commit",
          seq: evt.seq, text: typeof content === "string" ? content : "",
        };
      }
      if (evt.toolName === "resolve_outcome_open") {
        const o = evt.output as { roll: number; band?: { label?: string }; event_id: number };
        return {
          protocol: CLIENT_PROTOCOL, type: "roll_committed",
          eventId: o.event_id, rolls: [o.roll], total: o.roll, outcome: o.band?.label ?? "",
        };
      }
      if (evt.toolName === "resolve_contest_open") {
        const o = evt.output as {
          a?: { total?: number; rolls?: number[] }; b?: { total?: number; rolls?: number[] };
          winner: "a" | "b" | "tie"; event_id: number;
        };
        return {
          protocol: CLIENT_PROTOCOL, type: "roll_committed",
          eventId: o.event_id,
          rolls: [...(o.a?.rolls ?? []), ...(o.b?.rolls ?? [])],
          total: o.a?.total ?? 0, dc: o.b?.total,
          outcome: o.winner === "a" ? "success" : o.winner === "b" ? "fail" : "tie",
        };
      }
      // event_append / 暗骰 verdict：发机械回显增量(带可得文本)。
      return presentationDelta(evt);
    }
    case "reveal":
      // reveal_once：信号不丢(带 reveal changes)，web 收到 GET /presentation 取定稿副本。
      return {
        protocol: CLIENT_PROTOCOL, type: "presentation_delta",
        delta: { seq: evt.seq, changes: { reveal: [{ seq: evt.seq, target: "", text: "" }] } },
      };
    case "mutation":
    case "visibility":
    case "choice_staged":
      // 各 kind 各自映射成呈现增量(不再统一塌成无差别 presentation_delta；web 全量对账)。
      return presentationDelta(evt);
    default:
      return presentationDelta(evt);
  }
}

// 呈现增量：发 seq + 可得机械文本(若出参带 content)，web 收到后 GET /presentation 全量对账。
function presentationDelta(evt: CanonWriteEvent): StreamMessage {
  const content = (evt.output as { content?: unknown } | null)?.content;
  const text = typeof content === "string" ? content : undefined;
  return {
    protocol: CLIENT_PROTOCOL, type: "presentation_delta",
    delta: { seq: evt.seq, changes: text ? { mechanics: [{ seq: evt.seq, kind: "mutation", text }] } : {} },
  };
}

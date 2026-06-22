// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { CanonWriteEvent } from "@dicelore/core";

// resolve_*_open 出参 → roll_committed；其它规范态写 → presentation_delta(信号 + 可得机械文本)。
// web 收到 presentation_delta 后 GET /presentation 全量对账(接口 §5)。
export function mapCanonWrite(evt: CanonWriteEvent): StreamMessage | null {
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
  // 其它规范态写：发增量信号(web 收到后 refetch /presentation 对账)
  const content = (evt.output as { content?: unknown } | null)?.content;
  const text = typeof content === "string" ? content : undefined;
  return {
    protocol: CLIENT_PROTOCOL, type: "presentation_delta",
    delta: { seq: evt.seq, changes: text ? { mechanics: [{ seq: evt.seq, kind: "mutation", text }] } : {} },
  };
}

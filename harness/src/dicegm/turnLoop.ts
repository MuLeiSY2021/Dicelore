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
import { turnStartSeq, rollbackAfterSeq } from "@dicelore/backend";
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
  onSdkSession?: (id: string) => void; // 透传给 streamDriverTurn:agent sdk_session 事件→会话 metaSet 存 sdk_session_id(续接)
}

// 跑团回合：流式产出(streamDriverTurn,pkg 共享)→ 回合末跑 turn-end hook → choices/turn_ended。
// 呈现增量(presentation_delta)由 onCanonWrite 经 DiceSession→hub 异步发出,不在此处。
// B4：turn_ended.seq 取「全局 log event seq」(MAX(seq))而非 streamDriverTurn 的回合内计数器,
// 与 §1 快照 narrativeCursor 同口径,重连去重才可靠(narration_commit.seq 现由 onCanonWrite 用 evt.seq 全局对齐)。
export async function runTurn(deps: RunTurnDeps, input: TurnInput): Promise<void> {
  // RT-1 中期：回合级事务。开跑前记 turn_start_seq（当前全局 log MAX(seq)）；
  // 超时/error 时回滚到此起点，而非裸 return 把回合停在「GM 跑了一半被杀」的中间态。
  const startSeq = turnStartSeq(deps.db);
  // usage-stream §2：本回合 token 本地累计。包裹 deps.onUsage——既保留原落库回调
  // (DiceSession.onUsage→recordUsage 行为不变)，又把每次 usage 事件的四类 token 累加进
  // turnUsage，回合末搭进 turn_ended.usage(无 usage 事件则保持 undefined、省略该字段)。
  let turnUsage: TurnUsage | undefined;
  const streamDeps: RunTurnDeps = {
    ...deps,
    onUsage: (usage, model) => {
      turnUsage ??= { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
      turnUsage.inputTokens += usage.inputTokens;
      turnUsage.outputTokens += usage.outputTokens;
      turnUsage.cacheReadTokens += usage.cacheReadTokens;
      turnUsage.cacheCreationTokens += usage.cacheCreationTokens;
      deps.onUsage?.(usage, model); // 落库/透传行为不变
    },
  };
  const { errored } = await streamDriverTurn(streamDeps, input);
  if (errored) {
    // 删本回合落的 log 段 + 尽力逆回本回合 sheet 变更（轻量 DELETE，非快照 restore）。
    // residue = 无可逆信号的副作用残余（pending_roll/watcher 运行时态等）——不静默吞掉：
    // 记一条 warn 供运维/日志核对；结构化推给前端属 UI 接线（backlog-frontend CROSS-ERR），不在此处挂。
    const report = rollbackAfterSeq(deps.db, startSeq);
    if (report.residue.length > 0) {
      console.warn(
        `[turnLoop] 回合 ${deps.turnId} 超时/error 已回滚（删 ${report.deletedLogCount} 条 log、逆 ${report.stateReverted} 处 state），但下列副作用未自动回滚：\n  - ${report.residue.join("\n  - ")}`,
      );
    }
    return;
  }
  const send = (m: StreamMessage) => deps.hub.broadcast(deps.sessionId, m);
  const res = deps.runTurnEnd(deps.db);
  if (res.choices) send({ protocol: CLIENT_PROTOCOL, type: "choices", choices: res.choices });
  const r = deps.db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  send({
    protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: deps.turnId, seq: r.s ?? 0,
    ...(turnUsage ? { usage: turnUsage } : {}), // 无 usage 事件则省略字段(schema optional)
  });
}

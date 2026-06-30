// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { SessionBackend } from "@dicelore/interface";
import { auditTurn } from "./l3.js";

export function runTurnEnd(
  backend: SessionBackend,
  args: { transcriptHasText: boolean; stopHookActive: boolean },
): { block?: { reason: string } } {
  const turnStartSeq = Number(backend.metaGet("turn_start_seq") ?? "0");
  const events = backend.logSince(turnStartSeq);
  const pc = backend.getPendingChoice();
  const pendingChoiceEmpty = !pc || pc.status !== "staged";
  // 终局检测读 session_meta 的 "ended" 键(game_end 工具/FakeDiceGm gameEnd 档同时写它,
  // 与 REST/WS 终局态同源);旧实现嗅探 note.content "game_end" 恒 false——game_end 落库
  // 形态是 {kind:"note",visible:0,data_json:{reason,outcome}},从不写 content,见 io.ts gameEndHandler。
  const hasGameEnd = backend.metaGet("ended") !== undefined;

  const result = auditTurn({
    events,
    transcriptHasText: args.transcriptHasText,
    pendingChoiceEmpty,
    hasGameEnd,
    stopHookActive: args.stopHookActive,
  });

  // ① 物化暂存 choice(若 staged)。
  if (pc && pc.status === "staged") backend.materializePendingChoice();
  // ② 档B note 落 event(visible=0,喂 eval-loop)。
  for (const n of result.notes) backend.logAppend({ kind: "note", visible: 0, content: n.content });
  // ③ TODO(快照线): checkpoint —— 待并行 core 快照线落地接(adapter §8 ③)。

  return result.block ? { block: result.block } : {};
}

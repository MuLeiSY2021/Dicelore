// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/turnEnd.ts
import type { DB } from "../store/db.js";
import { logSince, logAppend } from "../store/log.js";
import { getPendingChoice, materializePendingChoice } from "../store/choice.js";
import { metaGet } from "../session/resolve.js";
import { auditTurn } from "./l3.js";

export function runTurnEnd(
  db: DB,
  args: { transcriptHasText: boolean; stopHookActive: boolean },
): { block?: { reason: string } } {
  const turnStartSeq = Number(metaGet(db, "turn_start_seq") ?? "0");
  const events = logSince(db, turnStartSeq);
  const pc = getPendingChoice(db);
  const pendingChoiceEmpty = !pc || pc.status !== "staged";
  const hasGameEnd = events.some((e) => e.kind === "note" && (e.content ?? "").includes("game_end"));

  const result = auditTurn({
    events,
    transcriptHasText: args.transcriptHasText,
    pendingChoiceEmpty,
    hasGameEnd,
    stopHookActive: args.stopHookActive,
  });

  // ① 物化暂存 choice(若 staged)。
  if (pc && pc.status === "staged") materializePendingChoice(db);
  // ② 档B note 落 event(visible=0,喂 eval-loop)。
  for (const n of result.notes) logAppend(db, { kind: "note", visible: 0, content: n.content });
  // ③ TODO(快照线): checkpoint(db, transcriptHead) —— 待并行 core 快照线落地接(adapter §8 ③)。

  return result.block ? { block: result.block } : {};
}

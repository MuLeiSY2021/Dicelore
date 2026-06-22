// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/l3.ts
import type { LogRow } from "../store/log.js";

export interface L3Input {
  events: LogRow[];
  transcriptHasText: boolean;
  pendingChoiceEmpty: boolean;
  hasGameEnd: boolean;
  stopHookActive: boolean;
}
export interface L3Note { content: string }
export interface L3Result { block?: { reason: string }; notes: L3Note[] }

// 档A:结构确凿、补救无歧义 → 当场 block;stopHookActive 防重入(最多纠一次)。
// 档B:语义/统计 → 只写 note 喂 eval-loop,不 block。
export function auditTurn(input: L3Input): L3Result {
  const notes: L3Note[] = [];
  const kinds = new Set(input.events.map((e) => e.kind));

  if (!input.stopHookActive) {
    if (input.pendingChoiceEmpty && !input.hasGameEnd) {
      return { block: { reason: "本轮未给玩家选择,请补 resolve_choice 再结束(非终局轮不能把玩家晾着)。" }, notes };
    }
    if (input.transcriptHasText && !kinds.has("narrate")) {
      return { block: { reason: "剧情请走 narrate(散文须落 event 才能审计/召回)。" }, notes };
    }
  }

  // 档B 统计:掷骰绕过率信号(本轮 verdict/mutation 数 vs narrate 数),写 note 供 eval。
  const mech = input.events.filter((e) => e.kind === "verdict" || e.kind === "mutation").length;
  const narr = input.events.filter((e) => e.kind === "narrate").length;
  if (mech > 0) notes.push({ content: `L3统计: 本轮机械事件=${mech} narrate=${narr}` });

  return { notes };
}

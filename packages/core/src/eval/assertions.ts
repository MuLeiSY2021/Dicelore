// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { EventRow } from "../store/event.js";

// eval 机械断言地板（客观、确定性、零 LLM）。语义判断（软着陆、明暗骰选对、与真人 GM 质量差距）
// 归带语料参考的 grader（见 eval/grader.md），不在此。本模块只判能机械确证的：
// narrate 泄漏（token 浪费）、漏 narrate、工具使用画像。

// 字符 n-gram shingle 集合（去空白），用于文本重叠度。
function shingles(s: string, n = 6): Set<string> {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n));
  return out;
}

// b 有多少比例出现在 a 中（|shingles(b) ∩ shingles(a)| / |shingles(b)|）。
function overlapRatio(a: string, b: string): number {
  const sb = shingles(b);
  if (sb.size === 0) return 0;
  const sa = shingles(a);
  let hit = 0;
  for (const g of sb) if (sa.has(g)) hit++;
  return hit / sb.size;
}

export interface NarrateLeakInput { assistantText: string; narrateTexts: string[] }
export interface NarrateLeakResult { assistantProse: number; overlap: number; leak: boolean }

// 玩家视图只认 narrate（+面板）；GM 在正文里复述的剧情玩家看不到、且白生成 = 浪费 token。
// leak ⟺ 正文有实质内容（>20 字）∧ 与 narrate 高度重叠（>0.5）。阈值可随 eval 调。
export function narrateLeak(input: NarrateLeakInput): NarrateLeakResult {
  const assistantProse = input.assistantText.trim().length;
  const overlap = overlapRatio(input.assistantText, input.narrateTexts.join(""));
  return { assistantProse, overlap, leak: assistantProse > 20 && overlap > 0.5 };
}

// 漏 narrate：正文有实质剧情（>20 字）但本轮无 narrate event（散文没进可审计/可召回/可呈现的通道）。
export function missingNarrate(input: { assistantText: string; narrateCount: number }): boolean {
  return input.assistantText.trim().length > 20 && input.narrateCount === 0;
}

export interface ToolStats {
  narrate: number; reveal: number; choice: number; mutation: number; watcherFired: number; note: number;
  verdictGated: number; // 明骰（resolve_*_open，data_json.gated=true）
  verdictAuto: number;  // 暗骰（resolve_*_hidden）
}

// 工具使用画像：供报告 + grader 参考（不直接判分）。
export function toolStats(events: EventRow[]): ToolStats {
  const s: ToolStats = { narrate: 0, reveal: 0, choice: 0, mutation: 0, watcherFired: 0, note: 0, verdictGated: 0, verdictAuto: 0 };
  for (const e of events) {
    switch (e.kind) {
      case "narrate": s.narrate++; break;
      case "reveal": s.reveal++; break;
      case "choice": s.choice++; break;
      case "mutation": s.mutation++; break;
      case "watcher_fired": s.watcherFired++; break;
      case "note": s.note++; break;
      case "verdict": {
        const gated = e.data_json ? (JSON.parse(e.data_json) as { gated?: boolean }).gated : false;
        if (gated) s.verdictGated++; else s.verdictAuto++;
        break;
      }
    }
  }
  return s;
}

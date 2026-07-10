// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 明骰内联档位表（RT-FE5 + rollband-narration §一.4 spoiler 矩阵）。
// 每档双叙述 plan(真相·驱动机械) + narration(玩家可见·可留白)，显隐纯由 spoiler 档决定：
//   严格：骰前只 label+区间；骰后命中档显 narration（plan 仍隐）；未命中档不显。
//   宽松：骰前显 narration；骰后命中档显 narration+plan；未命中档不显。
//   关闭：plan+narration 全显（含未命中档）。
// 与 visible 正交：plan 是 band 内字段、非 cell、不走 visible 标记（rollband §一 C6）。

import type { PendingRoll, SpoilerTier } from "@dicelore/shared";
import type { RollResult } from "@/features/play/useSession.js";

// RollBand 未在 shared 导出类型（仅 RollBandSchema）——从 PendingRoll.bands 派生。
export type RollBand = NonNullable<PendingRoll["bands"]>[number];

function hitBand(band: RollBand, result: RollResult | null): boolean {
  return result != null && result.total >= band.min && result.total <= band.max;
}

export function RollBands({ bands, tier, result }: { bands: RollBand[]; tier: SpoilerTier; result: RollResult | null }) {
  const rolled = result != null;
  return (
    <div className="bandtable" data-testid="play-roll-bands">
      {bands.map((b) => {
        const hit = hitBand(b, result);
        // 骰后：严格/宽松只显命中档；关闭显全部。
        if (rolled && tier !== "off" && !hit) return null;
        const parts: string[] = [];
        if (tier === "off") { parts.push(b.plan); if (b.narration && b.narration !== b.plan) parts.push(b.narration); }
        else if (tier === "loose") { parts.push(b.narration); if (rolled && hit) parts.push(b.plan); }
        else { /* strict */ if (rolled && hit) parts.push(b.narration); }
        return (
          <div className={"band" + (hit ? " hit" : "")} key={b.label} data-testid="play-roll-band">
            <span className="bg">{b.min === b.max ? b.min : `${b.min}–${b.max}`}</span>
            <span>{parts.filter(Boolean).join(" · ") || b.label}</span>
          </div>
        );
      })}
      {result && (
        <div className="rollresult" data-testid="play-dice-result">
          <div className="dice-die">{result.total}</div>
          <div className="rollout">{result.outcome}</div>
        </div>
      )}
    </div>
  );
}

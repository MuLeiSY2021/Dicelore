// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 内置极小「结构触发 → terse 提醒」表(spec §5);走流③、只回 AI、L1 底线。
// 富措辞归 Skills 包(L2),本表只 terse 底线。
export function remindersFor(name: string, out: any, input: any): string[] {
  switch (name) {
    case "resolve_choice":
      return ["后续叙述须与已锁后果一致"];
    case "resolve_outcome_hidden":
    case "resolve_outcome_open": {
      const mins: number[] = (input?.bands ?? []).map((b: any) => b.min);
      if (mins.length && out?.band && out.band.min === Math.min(...mins)) {
        return ["尊重结果,别软着陆"];
      }
      return [];
    }
    case "sheet_update":
      return out?.fired_watchers?.length ? ["watcher 已触发,本轮即时反应"] : [];
    default:
      return []; // resolve_contest_hidden 字段保留默认 []、narrate 不挂、读工具不挂
  }
}

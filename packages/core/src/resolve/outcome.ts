// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { rollDice, rangeMap, type Band, type Rng } from "../dice/index.js";
import { DiceloreError } from "../errors.js";

export interface OutcomeResult {
  roll: number;
  die: string;
  band: Band;
}

// 单骰串就地正则解析(不卷入 expr 文法);非此形状 → DIE_INVALID。
export function resolveOutcome(die: string, bands: Band[], rng?: Rng): OutcomeResult {
  const m = die.match(/^\s*(\d+)[dD](\d+)\s*$/);
  if (!m) throw new DiceloreError("DIE_INVALID", `resolveOutcome: 单骰串非法 "${die}"(只支持 NdS)`);
  const rolls = rollDice(Number(m[1]), Number(m[2]), rng); // count/sides 非法亦抛 DIE_INVALID
  const roll = rolls.reduce((a, b) => a + b, 0);
  const band = rangeMap(roll, bands); // 重叠/落空抛 RANGE_INVALID
  return { roll, die, band };
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { DiceloreError } from "@dicelore/errors";

export type Rng = () => number;

export interface Band {
  label: string;
  min: number;
  max: number;
  consequence?: string;
}

export function rollDice(count: number, sides: number, rng: Rng = Math.random): number[] {
  if (!Number.isInteger(count) || count < 1) throw new DiceloreError("DIE_INVALID", `rollDice: count 必须 ≥1，收到 ${count}`);
  if (!Number.isInteger(sides) || sides < 2) throw new DiceloreError("DIE_INVALID", `rollDice: sides 必须 ≥2，收到 ${sides}`);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(Math.floor(rng() * sides) + 1);
  return out;
}

export function rangeMap(value: number, bands: Band[]): Band {
  if (bands.length === 0) throw new DiceloreError("RANGE_INVALID", "rangeMap: bands 为空");
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].min > sorted[i].max) throw new DiceloreError("RANGE_INVALID", `rangeMap: 档位 ${sorted[i].label} min>max`);
    if (i > 0 && sorted[i].min <= sorted[i - 1].max) {
      throw new DiceloreError("RANGE_INVALID", `rangeMap: 档位区间重叠 ${sorted[i - 1].label}/${sorted[i].label}`);
    }
  }
  const hit = bands.find((b) => value >= b.min && value <= b.max);
  if (!hit) throw new DiceloreError("RANGE_INVALID", `rangeMap: 值 ${value} 落空(无覆盖档位)`);
  return hit;
}

export interface OutcomeResult {
  roll: number;
  die: string;
  band: Band;
}

// 单骰串就地正则解析(不卷入 expr 文法);非此形状 → DIE_INVALID。
// 纯函数·无 db,属骰子域内自洽封装(rollDice + rangeMap);storage-port ADR §3 单骰串不进 SessionBackend 端口,
// 住中立叶包 @dicelore/dice 供 harness/backend 双侧直接消费(归属判断 2026-06-29 采纳 C)。
export function resolveOutcome(die: string, bands: Band[], rng?: Rng): OutcomeResult {
  const m = die.match(/^\s*(\d+)[dD](\d+)\s*$/);
  if (!m) throw new DiceloreError("DIE_INVALID", `resolveOutcome: 单骰串非法 "${die}"(只支持 NdS)`);
  const rolls = rollDice(Number(m[1]), Number(m[2]), rng); // count/sides 非法亦抛 DIE_INVALID
  const roll = rolls.reduce((a, b) => a + b, 0);
  const band = rangeMap(roll, bands); // 重叠/落空抛 RANGE_INVALID
  return { roll, die, band };
}

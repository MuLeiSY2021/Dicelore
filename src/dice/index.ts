import { DiceloreError } from "../errors.js";

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

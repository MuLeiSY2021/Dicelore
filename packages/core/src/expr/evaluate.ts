// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { rollDice, type Rng } from "../dice/index.js";
import { parseExpr, type TermKind } from "./parse.js";
import { DiceloreError } from "../errors.js";

export type RefGetter = (entity: string, attr: string) => string | undefined;
export interface EvalCtx {
  rng?: Rng;
  getRef: RefGetter;
}

export interface ExprTerm {
  kind: TermKind;
  raw: string;
  sign: 1 | -1;
  rolls?: number[];
  refValue?: number;
  value: number;
}

export interface ExprLedger {
  total: number;
  terms: ExprTerm[];
}

export function evalExpr(expr: string, ctx: EvalCtx): ExprLedger {
  const terms: ExprTerm[] = parseExpr(expr).map((t) => {
    if (t.kind === "dice") {
      const rolls = rollDice(t.count!, t.sides!, ctx.rng);
      const value = rolls.reduce((a, b) => a + b, 0);
      return { kind: t.kind, raw: t.raw, sign: t.sign, rolls, value };
    }
    if (t.kind === "int") {
      return { kind: t.kind, raw: t.raw, sign: t.sign, value: t.intValue! };
    }
    const rawVal = ctx.getRef(t.entity!, t.attr!);
    if (rawVal === undefined) throw new DiceloreError("ENTITY_NOT_FOUND", `evalExpr: 引用不存在 {${t.entity}.${t.attr}}`);
    const num = Number(rawVal);
    if (!Number.isFinite(num)) throw new DiceloreError("NOT_NUMERIC", `evalExpr: 引用非数值 {${t.entity}.${t.attr}}="${rawVal}"`);
    return { kind: t.kind, raw: t.raw, sign: t.sign, refValue: num, value: num };
  });
  const total = terms.reduce((sum, t) => sum + t.sign * t.value, 0);
  return { total, terms };
}

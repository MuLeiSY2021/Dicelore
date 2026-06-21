// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { evalExpr, type EvalCtx } from "./evaluate.js";

export type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!=";
const OPS: CmpOp[] = ["<=", ">=", "==", "!=", "<", ">"]; // 长算符优先匹配

export function evalPredicate(pred: string, ctx: EvalCtx): boolean {
  let op: CmpOp | undefined;
  let idx = -1;
  for (const candidate of OPS) {
    const at = pred.indexOf(candidate);
    if (at !== -1) {
      op = candidate;
      idx = at;
      break;
    }
  }
  if (!op) throw new Error(`evalPredicate: 缺比较算符 — "${pred}"`);
  const left = evalExpr(pred.slice(0, idx).trim(), ctx).total;
  const right = evalExpr(pred.slice(idx + op.length).trim(), ctx).total;
  switch (op) {
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    case "==": return left === right;
    case "!=": return left !== right;
  }
}

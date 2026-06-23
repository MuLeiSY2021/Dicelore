// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { evalExpr, type EvalCtx } from "./evaluate.js";
import type { HasCond } from "../store/existsMatch.js";

export type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!=";
const OPS: CmpOp[] = ["<=", ">=", "==", "!=", "<", ">"]; // 长算符优先匹配

// has() 正则: {ns:has(内容)} 全行匹配
const HAS_RE = /^\{(\w+):has\((.+)\)\}$/;
// has 内部算符,长算符优先
const HAS_OPS = ["<=", ">=", "!=", "<", ">", "="];

export function parseHasConds(inner: string): HasCond[] {
  return inner.split(",").map((seg) => {
    const s = seg.trim();
    for (const op of HAS_OPS) {
      const at = s.indexOf(op);
      if (at !== -1) {
        return {
          col: s.slice(0, at).trim(),
          op,
          val: s.slice(at + op.length).trim().replace(/^['"]|['"]$/g, ""),
        };
      }
    }
    throw new Error(`has(): 段缺算符 "${s}"`);
  });
}

export function evalPredicate(pred: string, ctx: EvalCtx): boolean {
  const t = pred.trim();

  // has() 存在性匹配:必须在比较运算符切分之前处理,否则内部的 >= 会被外层误切
  const hm = t.match(HAS_RE);
  if (hm) {
    if (!ctx.existsMatch) throw new Error(`evalPredicate: has() 需 existsMatch — "${pred}"`);
    return ctx.existsMatch(hm[1], parseHasConds(hm[2]));
  }

  // 普通数值比较谓词
  let op: CmpOp | undefined;
  let idx = -1;
  for (const candidate of OPS) {
    const at = t.indexOf(candidate);
    if (at !== -1) {
      op = candidate;
      idx = at;
      break;
    }
  }
  if (!op) throw new Error(`evalPredicate: 缺比较算符 — "${pred}"`);
  const left = evalExpr(t.slice(0, idx).trim(), ctx).total;
  const right = evalExpr(t.slice(idx + op.length).trim(), ctx).total;
  switch (op) {
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    case "==": return left === right;
    case "!=": return left !== right;
  }
}


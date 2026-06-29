// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// TermKind 定义下沉 @dicelore/interface(经 ExprTerm→ContestResult 进 SessionBackend 方法面)；re-export 保持公共面。
import type { TermKind } from "@dicelore/interface";
export type { TermKind };

import { DiceloreError } from "@dicelore/errors";

export interface Term {
  kind: TermKind;
  sign: 1 | -1;
  raw: string;
  count?: number;
  sides?: number;
  intValue?: number;
  entity?: string;
  attr?: string;
}

// 先把引用 {…} 整体保护起来，再按顶层 +/- 切分
export function parseExpr(expr: string): Term[] {
  const tokens: { sign: 1 | -1; body: string }[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  let buf = "";
  const flush = () => {
    const body = buf.trim();
    if (body) tokens.push({ sign, body });
    buf = "";
  };
  while (i < expr.length) {
    const c = expr[i];
    if (c === "{") {
      const end = expr.indexOf("}", i);
      if (end === -1) throw new DiceloreError("EXPR_EVAL", `parseExpr: 引用缺 '}' — ${expr}`);
      buf += expr.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (c === "+" || c === "-") {
      flush();
      sign = c === "+" ? 1 : -1;
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  flush();

  return tokens.map(({ sign, body }) => parseTerm(sign, body));
}

function parseTerm(sign: 1 | -1, raw: string): Term {
  const ref = raw.match(/^\{(.+?)\.(.+)\}$/);
  if (ref) return { kind: "ref", sign, raw, entity: ref[1], attr: ref[2] };
  const dice = raw.match(/^(\d+)[dD](\d+)$/);
  if (dice) return { kind: "dice", sign, raw, count: Number(dice[1]), sides: Number(dice[2]) };
  if (/^\d+$/.test(raw)) return { kind: "int", sign, raw, intValue: Number(raw) };
  throw new DiceloreError("EXPR_EVAL", `parseExpr: 非法项 "${raw}"(只支持 NdS / 整数 / {实体.属性} 与 +/-）`);
}

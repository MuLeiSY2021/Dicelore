// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { evalExpr, type ExprLedger, type RefGetter } from "../expr/evaluate.js";
import { stateGet } from "../store/state.js";
import type { DB } from "../store/db.js";
import type { Rng } from "../dice/index.js";

export interface ContestSide {
  name: string;
  ledger: ExprLedger;
}
export interface ContestResult {
  a: ContestSide;
  b: ContestSide;
  winner: "a" | "b" | "tie";
}

export function resolveContest(
  db: DB,
  a: { name: string; expr: string },
  b: { name: string; expr: string },
  rng?: Rng,
): ContestResult {
  const getRef: RefGetter = (e, attr) => stateGet(db, e, attr)?.value; // 与 applyMutations 同构
  const ctx = { rng, getRef };
  const la = evalExpr(a.expr, ctx); // 求值失败透传 DiceloreError
  const lb = evalExpr(b.expr, ctx);
  const winner = la.total > lb.total ? "a" : lb.total > la.total ? "b" : "tie";
  return { a: { name: a.name, ledger: la }, b: { name: b.name, ledger: lb }, winner };
}

import { evalExpr, type ExprLedger, type RefGetter } from "../expr/evaluate.js";
import { sheetGet } from "../store/sheet.js";
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
  const getRef: RefGetter = (e, attr) => sheetGet(db, e, attr)?.value; // 与 applyMutations 同构
  const ctx = { rng, getRef };
  const la = evalExpr(a.expr, ctx); // 求值失败透传 DiceloreError
  const lb = evalExpr(b.expr, ctx);
  const winner = la.total > lb.total ? "a" : lb.total > la.total ? "b" : "tie";
  return { a: { name: a.name, ledger: la }, b: { name: b.name, ledger: lb }, winner };
}

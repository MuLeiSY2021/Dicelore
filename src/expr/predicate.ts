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

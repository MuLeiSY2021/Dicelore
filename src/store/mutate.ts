import type { Rng } from "../dice/index.js";
import { evalExpr, type RefGetter } from "../expr/evaluate.js";
import type { DB } from "./db.js";
import { sheetGet, sheetSetRaw } from "./sheet.js";
import { eventAppend } from "./event.js";
import { recomputeWatchers } from "./watcher.js";
import { DiceloreError } from "../errors.js";

export type MutOp = "+" | "-" | "=";

export interface Mutation {
  attr: string;
  op: MutOp;
  expr: string;
}

export interface MutationApplied {
  attr: string;
  op: MutOp;
  expr: string;
  kind: "rolled" | "set";
  old: string | null;
  rolls?: number[];
  delta?: number;
  new: string;
}

export interface MutationResult {
  entity: string;
  applied: MutationApplied[];
  fired_watchers: { id: number; payload: string }[];
  event_id: number;
}

// 词条字面量:形如 "药水*3"(成员名*数量)或 "药水"(数量默认 1)
function parseMember(expr: string): { name: string; qty: number } | null {
  const s = expr.trim();
  // 值表达式特征:含引用 / 含 ± / 纯整数 / 骰子 → 不是词条
  if (/[{}]/.test(s) || /[+\-]/.test(s) || /^\d+$/.test(s) || /^\d+[dD]\d+$/.test(s)) return null;
  const m = s.match(/^(.+?)\*(\d+)$/);
  if (m) return { name: m[1].trim(), qty: Number(m[2]) };
  return { name: s, qty: 1 };
}

export function applyMutations(
  db: DB,
  entity: string,
  mutations: Mutation[],
  opts?: { rng?: Rng },
): MutationResult {
  const getRef: RefGetter = (e, a) => sheetGet(db, e, a)?.value;
  const ctx = { rng: opts?.rng, getRef };

  const txn = db.transaction(() => {
    const applied: MutationApplied[] = [];
    for (const m of mutations) {
      const member = (m.op === "+" || m.op === "-" || m.op === "=") ? parseMember(m.expr) : null;

      // 词条分支:集合增减 / 赋文本
      if (member && (m.op === "+" || m.op === "-")) {
        const cellAttr = `${m.attr}:${member.name}`;
        const old = sheetGet(db, entity, cellAttr)?.value ?? null;
        const oldN = old === null ? 0 : toNum(old, cellAttr);
        const next = oldN + (m.op === "+" ? member.qty : -member.qty);
        if (next <= 0) db.prepare("DELETE FROM sheet WHERE entity=? AND attr=?").run(entity, cellAttr);
        else sheetSetRaw(db, entity, cellAttr, String(next));
        applied.push({ attr: cellAttr, op: m.op, expr: m.expr, kind: "set", old, delta: m.op === "+" ? member.qty : -member.qty, new: String(Math.max(next, 0)) });
        continue;
      }
      if (member && m.op === "=") {
        const old = sheetGet(db, entity, m.attr)?.value ?? null;
        sheetSetRaw(db, entity, m.attr, member.name);
        applied.push({ attr: m.attr, op: m.op, expr: m.expr, kind: "set", old, new: member.name });
        continue;
      }

      // 值表达式分支:标量算术 / 赋数
      const led = evalExpr(m.expr, ctx);
      const hasDice = led.terms.some((t) => t.kind === "dice");
      const old = sheetGet(db, entity, m.attr)?.value ?? null;
      let nextNum: number;
      if (m.op === "=") {
        nextNum = led.total;
      } else {
        const oldN = old === null ? 0 : toNum(old, m.attr);
        nextNum = oldN + (m.op === "+" ? led.total : -led.total);
      }
      sheetSetRaw(db, entity, m.attr, String(nextNum));
      applied.push({
        attr: m.attr, op: m.op, expr: m.expr,
        kind: hasDice ? "rolled" : "set",
        old, rolls: hasDice ? led.terms.flatMap((t) => t.rolls ?? []) : undefined,
        delta: m.op === "=" ? undefined : (m.op === "+" ? led.total : -led.total),
        new: String(nextNum),
      });
    }
    const event_id = eventAppend(db, { kind: "mutation", data_json: { entity, applied } });
    const fired_watchers = recomputeWatchers(db, ctx);
    return { entity, applied, fired_watchers, event_id };
  });

  return txn();
}

function toNum(raw: string, attr: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new DiceloreError("NOT_NUMERIC", `applyMutations: ${attr}="${raw}" 非数值,不能做算术`);
  return n;
}

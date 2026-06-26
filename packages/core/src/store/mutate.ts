// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { Rng } from "@dicelore/dice";
import { evalExpr } from "../expr/evaluate.js";
import type { DB } from "./db.js";
import { stateGet, stateSet, type StateKind } from "./state.js";
import { logAppend } from "./record.js";
import { recomputeWatchers } from "./watcher.js";
import { makeEvalCtx } from "./evalCtx.js";
import { DiceloreError } from "@dicelore/errors";

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
  opts?: { rng?: Rng; kind?: StateKind },
): MutationResult {
  const ctx = makeEvalCtx(db, { rng: opts?.rng });
  const kind = opts?.kind;

  const txn = db.transaction(() => {
    const applied: MutationApplied[] = [];
    for (const m of mutations) {
      const member = (m.op === "+" || m.op === "-" || m.op === "=") ? parseMember(m.expr) : null;

      // 词条分支:集合增减 / 赋文本
      if (member && (m.op === "+" || m.op === "-")) {
        const cellAttr = `${m.attr}:${member.name}`;
        const old = stateGet(db, entity, cellAttr)?.value ?? null;
        const oldN = old === null ? 0 : toNum(old, cellAttr);
        const next = oldN + (m.op === "+" ? member.qty : -member.qty);
        if (next <= 0) db.prepare("DELETE FROM state WHERE entity=? AND attr=?").run(entity, cellAttr);
        else stateSet(db, entity, cellAttr, String(next), undefined, kind);
        applied.push({ attr: cellAttr, op: m.op, expr: m.expr, kind: "set", old, delta: m.op === "+" ? member.qty : -member.qty, new: String(Math.max(next, 0)) });
        continue;
      }
      if (member && m.op === "=") {
        const old = stateGet(db, entity, m.attr)?.value ?? null;
        stateSet(db, entity, m.attr, member.name, undefined, kind);
        applied.push({ attr: m.attr, op: m.op, expr: m.expr, kind: "set", old, new: member.name });
        continue;
      }

      // 值表达式分支:标量算术 / 赋数
      let led;
      try {
        led = evalExpr(m.expr, ctx);
      } catch (e) {
        // op= 赋值宽容:非法算术 expr(如武器名"锈钉+2 (破甲)")降级为字面量字符串,
        // 避免开局建卡时 expr 解析器对实体名报 EXPR_EVAL 阻断整批事务。+/- 算术仍报错(要求数值)。
        if (m.op === "=") {
          const old = stateGet(db, entity, m.attr)?.value ?? null;
          stateSet(db, entity, m.attr, m.expr, undefined, kind);
          applied.push({ attr: m.attr, op: m.op, expr: m.expr, kind: "set", old, new: m.expr });
          continue;
        }
        throw e;
      }
      const hasDice = led.terms.some((t) => t.kind === "dice");
      const old = stateGet(db, entity, m.attr)?.value ?? null;
      let nextNum: number;
      if (m.op === "=") {
        nextNum = led.total;
      } else {
        const oldN = old === null ? 0 : toNum(old, m.attr);
        nextNum = oldN + (m.op === "+" ? led.total : -led.total);
      }
      stateSet(db, entity, m.attr, String(nextNum), undefined, kind);
      applied.push({
        attr: m.attr, op: m.op, expr: m.expr,
        kind: hasDice ? "rolled" : "set",
        old, rolls: hasDice ? led.terms.flatMap((t) => t.rolls ?? []) : undefined,
        delta: m.op === "=" ? undefined : (m.op === "+" ? led.total : -led.total),
        new: String(nextNum),
      });
    }
    const event_id = logAppend(db, { kind: "mutation", data_json: { entity, applied } });
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

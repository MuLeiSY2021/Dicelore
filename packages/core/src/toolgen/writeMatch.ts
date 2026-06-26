// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { DiceloreError } from "@dicelore/errors";
import { firstKeyword } from "./sqlGuard.js";

export type MutOp = "+" | "-" | "=";

export interface MutatePlan {
  kind: "mutate";
  entityParam: string;
  muts: { attr: string; op: MutOp; expr: string }[];
}

export interface SetStatusPlan {
  kind: "setStatus";
  table: string;
  idParam: string;
  statusParam: string;
}

export interface InsertPlan {
  kind: "insert";
  table: string;
  cols: string[];
  valParams: string[];
}

export type WritePlan = MutatePlan | SetStatusPlan | InsertPlan;

const NARRATIVE_TABLES = /^(front|plotline|foreshadow)$/i;

/**
 * 严格正则模式匹配器 — 只认三类封闭模式，任何不匹配的写形状 throw BAD_INPUT。
 *
 * 模式1 (mutate):
 *   UPDATE <table> SET <attr> = <attr> (+|-) :<param> [, <attr> = <attr> (+|-) :<param>]* WHERE entity = :<entityParam>
 *   UPDATE <table> SET <attr> = :<param> [, <attr> = :<param>]* WHERE entity = :<entityParam>
 *
 * 模式2 (setStatus):
 *   UPDATE (front|plotline|foreshadow) SET status = :<statusParam> WHERE id = :<idParam>
 *
 * 模式3 (insert):
 *   INSERT INTO (front|plotline|foreshadow) (<col1>, ...) VALUES (:<p1>, ...)
 */
export function matchWrite(sql: string): WritePlan {
  const normalized = sql.trim().replace(/\s+/g, " ");
  const kw = firstKeyword(normalized);

  if (kw === "UPDATE") {
    return matchUpdate(normalized);
  } else if (kw === "INSERT") {
    return matchInsert(normalized);
  } else {
    throw new DiceloreError("BAD_INPUT", `matchWrite: 不支持的 SQL 形状 (${kw})，只接受 UPDATE/INSERT`);
  }
}

// ── UPDATE 分支 ───────────────────────────────────────────────────────────────

// 拒绝 JOIN
const JOIN_RE = /\bJOIN\b/i;
// 拒绝 OR
const OR_RE = /\bOR\b/i;
// 拒绝子查询（左括号内含 SELECT）
const SUBQUERY_RE = /\(\s*SELECT\b/i;

/**
 * setStatus 严格模式:
 *   UPDATE <narrativeTable> SET status = :<statusParam> WHERE id = :<idParam>
 *
 * 注: 捕获组不区分 status/id 先后顺序在 WHERE 中，但我们要求严格顺序
 */
const SET_STATUS_RE =
  /^UPDATE\s+(\w+)\s+SET\s+status\s*=\s*:(\w+)\s+WHERE\s+id\s*=\s*:(\w+)\s*;?\s*$/i;

function matchUpdate(sql: string): WritePlan {
  // 拒绝复杂形状
  if (JOIN_RE.test(sql)) throw new DiceloreError("BAD_INPUT", "matchWrite: UPDATE 含 JOIN，不可映射");
  if (OR_RE.test(sql)) throw new DiceloreError("BAD_INPUT", "matchWrite: UPDATE 含 OR，不可映射");
  if (SUBQUERY_RE.test(sql)) throw new DiceloreError("BAD_INPUT", "matchWrite: UPDATE 含子查询，不可映射");

  // 先尝试 setStatus（更严格，优先）
  const ssm = SET_STATUS_RE.exec(sql);
  if (ssm) {
    const table = ssm[1];
    if (!NARRATIVE_TABLES.test(table)) {
      throw new DiceloreError("BAD_INPUT", `matchWrite: setStatus 只允许叙事表 front|plotline|foreshadow，收到 "${table}"`);
    }
    return {
      kind: "setStatus",
      table: table.toLowerCase(),
      statusParam: ssm[2],
      idParam: ssm[3],
    };
  }

  // 再尝试 mutate
  return matchMutate(sql);
}

/**
 * mutate 严格模式:
 *   UPDATE <table> SET <assignments> WHERE entity = :<entityParam>
 *
 * 每条 assignment 须是下列之一:
 *   <attr> = <attr> (+|-) :<param>     (算术 ±)
 *   <attr> = :<param>                   (直接赋值)
 *
 * WHERE 子句只允许 entity = :<param>，无 AND / OR / subquery
 */
const MUTATE_WHERE_RE = /WHERE\s+entity\s*=\s*:(\w+)\s*;?\s*$/i;
// 单条 assignment: attr = attr +|- :param  或  attr = :param
// attr 可以是中文或英文标识符
const ASSIGN_ARITH_RE = /^(\S+)\s*=\s*(\S+)\s*([+\-])\s*:(\w+)$/;
const ASSIGN_DIRECT_RE = /^(\S+)\s*=\s*:(\w+)$/;

function matchMutate(sql: string): MutatePlan {
  const whereMatch = MUTATE_WHERE_RE.exec(sql);
  if (!whereMatch) {
    throw new DiceloreError("BAD_INPUT", `matchWrite: 不可映射的 UPDATE 形状（缺少 WHERE entity=:param），sql: ${sql}`);
  }
  const entityParam = whereMatch[1];

  // 提取 SET … WHERE 之间的内容
  // 去掉 WHERE 及之后部分
  const whereIdx = sql.search(/\bWHERE\b/i);
  const setIdx = sql.search(/\bSET\b/i);
  if (setIdx === -1) throw new DiceloreError("BAD_INPUT", `matchWrite: UPDATE 缺 SET 子句`);

  const setClause = sql.slice(setIdx + 3, whereIdx).trim();

  // 拒绝多 WHERE 条件（AND / OR 已在上面 OR_RE 拒绝；安全补充：看 setClause 是否含 WHERE）
  if (/\bAND\b/i.test(setClause)) {
    throw new DiceloreError("BAD_INPUT", "matchWrite: SET 子句含 AND，不可映射");
  }

  // 拆分多个赋值列（按 , 分割，但要小心中文属性名不含逗号）
  // 简单策略：按顶层逗号分割
  const assignments = splitTopLevelCommas(setClause);

  const muts: MutatePlan["muts"] = [];
  for (const raw of assignments) {
    const a = raw.trim();

    // 算术赋值: attr = attr ± :param
    const arith = ASSIGN_ARITH_RE.exec(a);
    if (arith) {
      const lAttr = arith[1];
      const rAttr = arith[2];
      // 确保左右 attr 相同（自引用）
      if (lAttr !== rAttr) {
        throw new DiceloreError("BAD_INPUT", `matchWrite: 算术赋值左右 attr 不同 (${lAttr} vs ${rAttr})，不可映射`);
      }
      muts.push({ attr: lAttr, op: arith[3] as MutOp, expr: `:${arith[4]}` });
      continue;
    }

    // 直接赋值: attr = :param
    const direct = ASSIGN_DIRECT_RE.exec(a);
    if (direct) {
      muts.push({ attr: direct[1], op: "=", expr: `:${direct[2]}` });
      continue;
    }

    throw new DiceloreError("BAD_INPUT", `matchWrite: 无法解析赋值表达式 "${a}"，不可映射`);
  }

  if (muts.length === 0) {
    throw new DiceloreError("BAD_INPUT", "matchWrite: SET 子句无有效赋值");
  }

  return { kind: "mutate", entityParam, muts };
}

// ── INSERT 分支 ───────────────────────────────────────────────────────────────

/**
 * INSERT INTO (front|plotline|foreshadow) (<col1>, <col2>, ...) VALUES (:<p1>, :<p2>, ...)
 */
const INSERT_RE =
  /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)\s*;?\s*$/i;

function matchInsert(sql: string): InsertPlan {
  // 拒绝子查询
  if (SUBQUERY_RE.test(sql)) throw new DiceloreError("BAD_INPUT", "matchWrite: INSERT 含子查询，不可映射");

  const m = INSERT_RE.exec(sql);
  if (!m) {
    throw new DiceloreError("BAD_INPUT", `matchWrite: 不可映射的 INSERT 形状，sql: ${sql}`);
  }

  const table = m[1];
  if (!NARRATIVE_TABLES.test(table)) {
    throw new DiceloreError("BAD_INPUT", `matchWrite: INSERT 只允许叙事表 front|plotline|foreshadow，收到 "${table}"`);
  }

  const cols = m[2].split(",").map((c) => c.trim());
  const valRaw = m[3].split(",").map((v) => v.trim());

  // 每个 value 须是 :param
  const valParams: string[] = [];
  for (const v of valRaw) {
    const pm = /^:(\w+)$/.exec(v);
    if (!pm) {
      throw new DiceloreError("BAD_INPUT", `matchWrite: INSERT VALUES 包含非命名参数 "${v}"，不可映射`);
    }
    valParams.push(pm[1]);
  }

  if (cols.length !== valParams.length) {
    throw new DiceloreError("BAD_INPUT", "matchWrite: INSERT 列数与参数数不符");
  }

  return { kind: "insert", table: table.toLowerCase(), cols, valParams };
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 按顶层逗号分割（不进入括号内） */
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

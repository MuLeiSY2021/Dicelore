// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import { DiceloreError } from "@dicelore/errors";

export interface HasCond { col: string; op: string; val: string; }

const TABLES: Record<string, { table: string; cols: Set<string> }> = {
  state: { table: "state", cols: new Set(["entity","attr","value","kind","visible","rel_object","rel_dim","clock_min","clock_max","clock_mode"]) },
  plotline: { table: "plotline", cols: new Set(["id","title","summary","status"]) },
  front: { table: "front", cols: new Set(["id","name","stakes","clock_ref","status"]) },
  foreshadow: { table: "foreshadow", cols: new Set(["id","content","status"]) },
  log: { table: "log", cols: new Set(["seq","kind","content","tags","is_moment","visible"]) },
  anchor: { table: "anchor", cols: new Set(["owner_table","owner_id","target_table","target_id","role"]) },
};

const SQL_OP: Record<string, string> = { "=":"=", "!=":"!=", "<":"<", "<=":"<=", ">":">", ">=":">=" };

export function makeExistsMatch(db: DB) {
  return (ns: string, conds: HasCond[], sinceSeq?: number): boolean => {
    const def = TABLES[ns];
    if (!def) throw new DiceloreError("BAD_INPUT", `has(): 未知命名空间 "${ns}"`);
    const wh: string[] = [];
    const params: unknown[] = [];
    for (const c of conds) {
      if (!def.cols.has(c.col)) throw new DiceloreError("BAD_INPUT", `has(): ${ns} 无列 "${c.col}"`);
      const sop = SQL_OP[c.op];
      if (!sop) throw new DiceloreError("BAD_INPUT", `has(): 非法算符 "${c.op}"`);
      const isNum = /^-?\d+(\.\d+)?$/.test(c.val.trim());
      if (isNum) {
        // 数值比较：CAST 列为 REAL，避免文本 > 数字的 SQLite 类型亲和陷阱
        wh.push(`CAST(${c.col} AS REAL) ${sop} ?`);
        params.push(Number(c.val));
      } else {
        wh.push(`${c.col} ${sop} ?`);
        params.push(c.val);
      }
    }
    if (ns === "log" && sinceSeq !== undefined) { wh.push("seq > ?"); params.push(sinceSeq); }
    const sql = `SELECT 1 FROM ${def.table}${wh.length ? " WHERE " + wh.join(" AND ") : ""} LIMIT 1`;
    return (db.prepare(sql).get(...params) as unknown) !== undefined;
  };
}

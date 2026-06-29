// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { Rng } from "@dicelore/dice";
import type { DB } from "./db.js";
import { ftsIndex, ftsSearch } from "./fts.js";

// Lore 定义下沉 @dicelore/interface(SessionBackend 方法面引用)；re-export 保持公共面。
import type { Lore } from "@dicelore/interface";
export type { Lore };

// 按 name 寻址(灌注不重名;AI/作者再写同名 = 覆盖)。name 无 UNIQUE 约束,代码层保证。
export function loreUpsert(
  db: DB,
  d: { name: string; content: string; category?: string; tags?: string; visible?: number },
): number {
  const existing = db.prepare("SELECT rowid FROM lore WHERE name=?").get(d.name) as { rowid: number } | undefined;
  let rowid: number;
  if (existing) {
    rowid = existing.rowid;
    db.prepare("UPDATE lore SET content=?, category=?, tags=?, visible=? WHERE rowid=?").run(
      d.content, d.category ?? null, d.tags ?? null, d.visible ?? 0, rowid,
    );
  } else {
    const info = db
      .prepare("INSERT INTO lore (name, content, category, tags, visible) VALUES (?, ?, ?, ?, ?)")
      .run(d.name, d.content, d.category ?? null, d.tags ?? null, d.visible ?? 0);
    rowid = Number(info.lastInsertRowid);
  }
  ftsIndex(db, "lore_fts", rowid, `${d.name}\n${d.content}${d.tags ? "\n" + d.tags : ""}`);
  return rowid;
}

export function loreGet(db: DB, name: string): Lore | undefined {
  return db
    .prepare("SELECT rowid, name, content, category, tags, visible FROM lore WHERE name=? LIMIT 1")
    .get(name) as Lore | undefined;
}

export function loreSearch(db: DB, query: string, limit = 20): Lore[] {
  const hits = ftsSearch(db, "lore_fts", query, limit);
  const stmt = db.prepare("SELECT rowid, name, content, category, tags, visible FROM lore WHERE rowid=?");
  return hits.map((h) => stmt.get(h.rowid) as Lore | undefined).filter((r): r is Lore => r !== undefined);
}

export interface PoolAdd {
  pool: string;
  row: Record<string, unknown>;
  weight?: number;
  source?: "author" | "ai";
  visible?: number;
}

export function poolAdd(db: DB, a: PoolAdd): number {
  const info = db
    .prepare("INSERT INTO pool (pool, row_json, weight, source, visible) VALUES (?, ?, ?, ?, ?)")
    .run(a.pool, JSON.stringify(a.row), a.weight ?? 1, a.source ?? "author", a.visible ?? 0);
  return Number(info.lastInsertRowid);
}

// 运行期 AI 现编(§4.3:source 是 author/ai 迁移钩子)。必经 store → 快照可覆盖。
export function worldRegister(db: DB, a: Omit<PoolAdd, "source">): number {
  return poolAdd(db, { ...a, source: "ai" });
}

export function poolSample(
  db: DB,
  pool: string,
  n: number,
  opts: { filter?: Record<string, string | number>; rng?: Rng } = {},
): Record<string, unknown>[] {
  const rng = opts.rng ?? Math.random;
  let sql = "SELECT weight, row_json FROM pool WHERE pool=?";
  const args: (string | number)[] = [pool];
  if (opts.filter) {
    for (const [k, v] of Object.entries(opts.filter)) {
      // filter key 拼入 '$.<key>' JSON 路径；含 '.' 的 key 解析为嵌套路径，畸形 key 静默返回空行。
      sql += " AND json_extract(row_json, '$.' || ?) = ?";
      args.push(k, v);
    }
  }
  const rows = (db.prepare(sql).all(...args) as { weight: number; row_json: string }[]).map((r) => ({
    weight: r.weight,
    row: JSON.parse(r.row_json) as Record<string, unknown>,
  }));

  // 加权无放回抽样:每轮按剩余 weight 归一抽 1、移除,重复 n 次。
  const out: Record<string, unknown>[] = [];
  for (let k = 0; k < n && rows.length > 0; k++) {
    const total = rows.reduce((s, r) => s + r.weight, 0);
    let x = rng() * total;
    let i = 0;
    while (i < rows.length - 1 && x >= rows[i].weight) {
      x -= rows[i].weight;
      i++;
    }
    out.push(rows[i].row);
    rows.splice(i, 1);
  }
  return out;
}

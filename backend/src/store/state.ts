// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

// StateKind / StateCell 定义下沉 @dicelore/interface(SessionBackend 方法面引用)；此处 re-export 保持本模块公共面不变。
import type { StateKind, StateCell } from "@dicelore/interface";
export type { StateKind, StateCell };

const SELECT_COLS =
  "entity, attr, value, visible, kind, rel_object, rel_dim, clock_min, clock_max, clock_mode";

export function stateGet(db: DB, entity: string, attr: string): StateCell | undefined {
  return db
    .prepare(`SELECT ${SELECT_COLS} FROM state WHERE entity=? AND attr=?`)
    .get(entity, attr) as StateCell | undefined;
}

// prefix 形如 "张三." 或 "张三.库存:"。约定:prefix 以 "." 分隔 entity 与 attr 前缀。
export function stateList(db: DB, prefix: string): StateCell[] {
  const dot = prefix.indexOf(".");
  if (dot === -1) throw new Error(`stateList: prefix 需含 '.'(如 "张三." )— 收到 "${prefix}"`);
  const entity = prefix.slice(0, dot);
  const attrPrefix = prefix.slice(dot + 1);
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLS} FROM state WHERE entity=? AND attr LIKE ? ESCAPE '\\' ORDER BY attr`,
    )
    .all(entity, likePrefix(attrPrefix));
  return rows as StateCell[];
}

function likePrefix(p: string): string {
  const escaped = p.replace(/[\\%_]/g, (m) => "\\" + m);
  return escaped + "%";
}

/**
 * 写一格 state。
 * @param visible 省略则新建按 0(暗)、冲突时不动旧 visible；给值则覆盖 visible。
 * @param kind 省略则新建按表默认 'world'、冲突时不动旧 kind；给值则新建时落该 kind。
 *   kind 在 ON CONFLICT 时**不覆盖**(一个 entity.attr 的 kind 归属不应被改写)——npc_update
 *   改已有 npc 行时 kind 仍为 npc(首次 register 已落);仅新建行时由调用方携带 kind。
 */
export function stateSet(
  db: DB,
  entity: string,
  attr: string,
  value: string,
  visible?: number,
  kind?: StateKind,
): void {
  if (visible === undefined) {
    db.prepare(
      `INSERT INTO state (entity, attr, value, visible, kind) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value`,
    ).run(entity, attr, value, kind ?? "world");
  } else {
    db.prepare(
      `INSERT INTO state (entity, attr, value, visible, kind) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value, visible=excluded.visible`,
    ).run(entity, attr, value, visible, kind ?? "world");
  }
}

/** Clock 初始化：写入 value(初始进度) + clock_min/clock_max/clock_mode 三元组。供 fronts 物化使用。 */
export function stateSetClock(
  db: DB,
  entity: string,
  attr: string,
  opts: { value: string; visible?: number; clock_min: number; clock_max: number; clock_mode: string },
): void {
  db.prepare(
    `INSERT INTO state (entity, attr, value, visible, clock_min, clock_max, clock_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity, attr) DO UPDATE SET
       value=excluded.value, visible=excluded.visible,
       clock_min=excluded.clock_min, clock_max=excluded.clock_max, clock_mode=excluded.clock_mode`,
  ).run(entity, attr, opts.value, opts.visible ?? 0, opts.clock_min, opts.clock_max, opts.clock_mode);
}

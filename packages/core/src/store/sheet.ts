// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export interface Cell {
  entity: string;
  attr: string;
  value: string;
  visible: number;
}

export function sheetGet(db: DB, entity: string, attr: string): Cell | undefined {
  const row = db.prepare("SELECT entity, attr, value, visible FROM sheet WHERE entity=? AND attr=?").get(entity, attr);
  return row as Cell | undefined;
}

// prefix 形如 "张三." 或 "张三.库存:"。约定:prefix 以 "." 分隔 entity 与 attr 前缀。
export function sheetList(db: DB, prefix: string): Cell[] {
  const dot = prefix.indexOf(".");
  if (dot === -1) throw new Error(`sheetList: prefix 需含 '.'(如 "张三." )— 收到 "${prefix}"`);
  const entity = prefix.slice(0, dot);
  const attrPrefix = prefix.slice(dot + 1);
  const rows = db
    .prepare("SELECT entity, attr, value, visible FROM sheet WHERE entity=? AND attr LIKE ? ESCAPE '\\' ORDER BY attr")
    .all(entity, likePrefix(attrPrefix));
  return rows as Cell[];
}

function likePrefix(p: string): string {
  const escaped = p.replace(/[\\%_]/g, (m) => "\\" + m);
  return escaped + "%";
}

export function sheetSetRaw(db: DB, entity: string, attr: string, value: string, visible?: number): void {
  if (visible === undefined) {
    db.prepare(
      `INSERT INTO sheet (entity, attr, value, visible) VALUES (?, ?, ?, 0)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value`,
    ).run(entity, attr, value);
  } else {
    db.prepare(
      `INSERT INTO sheet (entity, attr, value, visible) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value, visible=excluded.visible`,
    ).run(entity, attr, value, visible);
  }
}

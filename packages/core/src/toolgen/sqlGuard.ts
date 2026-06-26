// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { DiceloreError } from "@dicelore/errors";

const WRITE_KW =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM)\b/i;

export function firstKeyword(sql: string): string {
  const m = sql.trim().match(/^(\w+)/);
  return m ? m[1].toUpperCase() : "";
}

export function assertReadOnlySelect(sql: string): void {
  const s = sql.trim().replace(/;\s*$/, ""); // 容忍单个尾分号
  if (s.includes(";")) throw new DiceloreError("BAD_INPUT", "sql: 禁多语句");
  if (firstKeyword(s) !== "SELECT")
    throw new DiceloreError("BAD_INPUT", "sql: 只读位置须 SELECT");
  if (WRITE_KW.test(s))
    throw new DiceloreError("BAD_INPUT", `sql: 只读位置含写/危险关键字`);
}

export function extractParams(sql: string): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/:(\w+)/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

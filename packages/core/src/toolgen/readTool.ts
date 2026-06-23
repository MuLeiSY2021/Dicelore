// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { DiceloreError } from "../errors.js";
import { assertReadOnlySelect } from "./sqlGuard.js";

export interface ReadToolDecl {
  name: string;
  desc?: string;
  /** 参数声明: { paramName: "string" | "int" | "number" }。boundParams 只取此键集。 */
  params?: Record<string, string>;
  sql: string;
}

export interface ReadTool {
  name: string;
  desc: string;
  handler: (db: DB, args: Record<string, unknown>) => unknown[];
}

/**
 * 将声明编译为读工具。
 * - sql 必须通过 assertReadOnlySelect
 * - handler = db.prepare(sql).all(boundParams)
 * - boundParams 只取 decl.params 声明的键；缺失必要参数时抛 BAD_INPUT
 */
export function compileReadTool(decl: ReadToolDecl): ReadTool {
  // 编译时即校验（快速失败）
  assertReadOnlySelect(decl.sql);

  const paramKeys = decl.params ? Object.keys(decl.params) : [];

  const handler = (db: DB, args: Record<string, unknown>): unknown[] => {
    const boundParams: Record<string, unknown> = {};
    for (const key of paramKeys) {
      if (!(key in args)) {
        throw new DiceloreError(
          "BAD_INPUT",
          `readTool "${decl.name}": 缺少必要参数 "${key}"`,
        );
      }
      boundParams[key] = args[key];
    }
    return db.prepare(decl.sql).all(boundParams) as unknown[];
  };

  return {
    name: decl.name,
    desc: decl.desc ?? "",
    handler,
  };
}

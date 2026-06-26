// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { DiceloreError } from "@dicelore/errors";
import { assertReadOnlySelect } from "./sqlGuard.js";

const VALID_NAME = /^\w+$/;

/** 定义一个只读 SQLite 视图。name 必须是合法标识符（^\w+$），sql 必须是只读 SELECT。 */
export function defineView(db: DB, name: string, sql: string): void {
  if (!VALID_NAME.test(name)) {
    throw new DiceloreError("BAD_INPUT", `defineView: 非法视图名 "${name}"，须匹配 ^\\w+$`);
  }
  assertReadOnlySelect(sql); // 挡写/危险关键字
  db.exec(`CREATE VIEW ${name} AS ${sql}`);
}

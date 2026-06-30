// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/interface —— harness 与 backend 之间的跨层契约（依赖倒置：双方都依赖此处、不互相 import）。
// storage-port 的 SessionBackend 聚合接口在此（见 backend.ts）。
// 见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(决策②③)。

import type Database from "better-sqlite3";
import type { z } from "zod";

/** 每局一个 SQLite 句柄（better-sqlite3）。store 实现与工具契约共用此别名。 */
export type DB = Database.Database;

/** MCP 工具的语义标注（塑形/审计用）。 */
export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/** 一个 MCP 工具的定义契约——由 toolgen/作者声明产出，被 mcp 工具面装载。
 *  跨 harness（工具面）与 backend（toolgen/catalog 编译产出）两层，故置于中立 interface 包。 */
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  outputSchema: z.ZodObject<z.ZodRawShape>;
  annotations: ToolAnnotations;
  handler: (db: DB, input: any) => any;
}

// 域类型(SessionBackend 方法面引用)与端口接口本体。见 domain.ts / backend.ts 头注。
export * from "./domain.js";
export * from "./backend.js";

/** 纯零依赖字符串截断助手(无 db、无状态)。原住 backend/store/truncate.ts,被 mcp 工具面(harness)
 *  消费——非存储端口操作、纯工具,归中立 interface 包(归属判断 2026-06-29:零域、零依赖)。 */
export function truncateText(s: string, limit = 25000): { text: string; truncated: boolean } {
  if (s.length <= limit) return { text: s, truncated: false };
  return { text: s.slice(0, limit), truncated: true };
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";
import type { DB } from "../store/db.js";
import { firstKeyword } from "./sqlGuard.js";
import { compileTool, type ToolDecl } from "./compile.js";
import type { ToolDef } from "../mcp/tooldef.js";

// 把声明的 params 类型字符串映射为 zod 校验器。
function paramSchema(type: string): z.ZodTypeAny {
  switch (type) {
    case "int":
      return z.number().int();
    case "number":
      return z.number();
    case "string":
      return z.string();
    default:
      // 未知类型保守按 string（toolgen 自身不限制，但 v1 仅这三类）
      return z.string();
  }
}

/**
 * 把一条声明式工具声明（ToolDecl）适配为 MCP 运行时工具面的 ToolDef。
 * - inputSchema：由 decl.params 生成 .strict() ZodObject（缺参/类型错即拒）
 * - outputSchema：统一 { result: unknown }（读工具回数组、写工具回原语结果，包一层满足 ZodObject）
 * - annotations：读 readOnlyHint=true，写 false；openWorldHint 全局 false
 * - handler：compileTool 出的 handler 出参包 { result }
 */
export function toolgenToToolDef(decl: ToolDecl): ToolDef {
  const compiled = compileTool(decl); // 编译期校验（坏 sql 在此抛）
  const isRead = firstKeyword(decl.sql) === "SELECT";

  const shape: z.ZodRawShape = {};
  for (const [key, type] of Object.entries(decl.params ?? {})) {
    shape[key] = paramSchema(type);
  }
  const inputSchema = z.object(shape).strict();
  const outputSchema = z.object({ result: z.unknown() });

  return {
    name: compiled.name,
    title: compiled.desc || compiled.name,
    description: compiled.desc,
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: isRead,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: (db: DB, input: Record<string, unknown>) => ({
      result: compiled.handler(db, input),
    }),
  };
}

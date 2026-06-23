// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { firstKeyword } from "./sqlGuard.js";
import { compileReadTool, type ReadTool, type ReadToolDecl } from "./readTool.js";
import { compileWriteTool, type WriteTool, type WriteToolDecl } from "./writeTool.js";

/** MCP 工具声明：单 `sql`，按首词分流为读/写工具。 */
export type ToolDecl = ReadToolDecl & WriteToolDecl; // 同形 { name, desc?, params?, sql }
export type CompiledTool = ReadTool | WriteTool;

/**
 * 把一条 MCP 工具声明编译为读或写工具：
 * - sql 首词 SELECT → compileReadTool（只读，可引视图+物理表）
 * - 否则（UPDATE/INSERT/…）→ compileWriteTool（解析匹配正典原语，防泄露）
 */
export function compileTool(decl: ToolDecl): CompiledTool {
  return firstKeyword(decl.sql) === "SELECT" ? compileReadTool(decl) : compileWriteTool(decl);
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/mcp/runTool.ts
import type { DB } from "../store/db.js";
import type { ToolDef } from "./tooldef.js";
import { successEnvelope, errorEnvelope, type CallToolResult } from "./envelope.js";
import { remindersFor } from "./reminders.js";

export async function runTool(db: DB, tool: ToolDef, rawInput: unknown): Promise<CallToolResult> {
  try {
    const input = tool.inputSchema.parse(rawInput); // 防御 + 脱 SDK 单测;ZodError 走错误信封(INTERNAL)
    const out = await tool.handler(db, input); // await:兼容 sync(直接值)与明骰 async(Promise)handler
    const reminders = remindersFor(tool.name, out, input);
    const sc = reminders.length ? { ...out, reminders } : out;
    return successEnvelope(out, sc);
  } catch (e) {
    return errorEnvelope(e);
  }
}

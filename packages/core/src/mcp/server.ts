// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../store/db.js";
import { TOOLS } from "./tools.js";
import type { ToolDef } from "./tooldef.js";
import { runTool } from "./runTool.js";
import { setRollGate, type RollGate } from "./rollGate.js";
import { getLogger } from "../log.js";

export interface CanonWriteEvent {
  kind: "mutation" | "event" | "visibility" | "reveal" | "choice_staged" | "game_end";
  seq: number; // 写后的 store head seq
  toolName: string; // 触发的工具内部名(无 dicelore_ 前缀)
  output: unknown; // 工具原始出参(从信封 content[0].text 解出)
}
export interface McpServerDeps {
  onCanonWrite?: (evt: CanonWriteEvent) => void;
  rollGate?: RollGate;
}

// 工具名 → CanonWriteEvent.kind；不在表中的工具不发 onCanonWrite。
// 名取自 packages/core/src/mcp/handlers/*（无 watcher_fired 工具——watcher 隐式触发）。
const CANON_KIND: Record<string, CanonWriteEvent["kind"]> = {
  sheet_update: "mutation",
  event_append: "event",
  narrate: "event",
  sheet_show: "visibility",
  world_show: "visibility",
  reveal_once: "reveal",
  resolve_choice: "choice_staged",
  game_end: "game_end",
  resolve_outcome_open: "event",
  resolve_contest_open: "event",
  resolve_outcome_hidden: "event",
  resolve_contest_hidden: "event",
};

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  return r.s ?? 0;
}

// 「调用工具 + 写后 onCanonWrite」封装(供工厂注册 + 单测复用)。runTool 是 async、返回信封。
export function wrapToolForTest(db: DB, deps: McpServerDeps, extraTools: ToolDef[] = []) {
  const byName = new Map([...TOOLS, ...extraTools].map((t) => [t.name, t]));
  return async (name: string, args: unknown): Promise<unknown> => {
    const t = byName.get(name);
    if (!t) throw new Error(`未知工具: ${name}`);
    const result = await runTool(db, t, args);
    const kind = CANON_KIND[name];
    if (kind && deps.onCanonWrite && !result.isError) {
      let output: unknown = undefined;
      try { output = JSON.parse(result.content[0]?.text ?? "null"); } catch (e) { getLogger().warn({ err: e, toolName: name }, "信封 content 非 JSON,降级为 null output"); }
      deps.onCanonWrite({ kind, seq: maxSeq(db), toolName: name, output });
    }
    return result;
  };
}

export function createMcpServer(db: DB, deps: McpServerDeps = {}, extraTools: ToolDef[] = []): McpServer {
  if (deps.rollGate) setRollGate(deps.rollGate); // 单人明骰：接既有模块级 gate seam
  const server = new McpServer({ name: "dicelore", version: "0.0.0" });
  const invoke = wrapToolForTest(db, deps, extraTools);
  for (const t of [...TOOLS, ...extraTools]) {
    server.registerTool(
      `dicelore_${t.name}`,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema.shape,
        outputSchema: t.outputSchema.shape,
        annotations: t.annotations,
      },
      (args: unknown) => invoke(t.name, args) as any,
    );
  }
  return server;
}

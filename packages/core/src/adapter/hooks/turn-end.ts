// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/hooks/turn-end.ts
// 薄入口:读 stdin(transcript_path / stop_hook_active,字段以实现期官方文档为准)→ 装配 → decision JSON。
import { readFileSync } from "node:fs";
import { openSession } from "../../session/resolve.js";
import { runTurnEnd } from "../turnEnd.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
const input = (() => { try { return JSON.parse(raw || "{}"); } catch { return {}; } })() as
  { transcript_path?: string; stop_hook_active?: boolean };

// 本轮 transcript 是否有实质 assistant 文本(简化:文件非空即有;精确解析留实现期)。
let transcriptHasText = true;
try { if (input.transcript_path) transcriptHasText = readFileSync(input.transcript_path, "utf8").trim().length > 0; } catch { /* 容错 */ }

const { db } = openSession();
const r = runTurnEnd(db, { transcriptHasText, stopHookActive: Boolean(input.stop_hook_active) });
process.stdout.write(JSON.stringify(r.block ? { decision: "block", reason: r.block.reason } : {}));

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// packages/core/src/adapter/hooks/turn-start.ts
// 薄入口:读 stdin.prompt(字段以实现期官方文档为准)→ rule 召回 + 记 seq → 注 additionalContext。
import { openSession } from "../../session/resolve.js";
import { recallRules, recordTurnStart } from "../ruleRecall.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
let prompt = "";
try { prompt = (JSON.parse(raw || "{}") as { prompt?: string }).prompt ?? ""; } catch { /* 容错 */ }

const { db } = openSession();
recordTurnStart(db);
// TODO(快照线): detectAndRestore(db, transcriptHead) —— 待并行 core 快照线落地接(adapter §8)。
const additionalContext = recallRules(db, prompt);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext },
}));

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// eval/grade.ts — 对一局已捕获的会话评分（player-view + 机械断言）。立即可跑：
//   npx tsx eval/grade.ts <session.db> [--transcript <cc-transcript.jsonl>] [--scenario <id>]
// 纯确定性、零 LLM；语义/对标真人语料的定性评测见 eval/grader.md（另起 grader）。
import { readFileSync } from "node:fs";
import { openDb } from "../src/store/db.js";
import { eventSince } from "../src/store/event.js";
import { buildPlayerView } from "../src/present/playerView.js";
import { narrateLeak, missingNarrate, toolStats } from "../src/eval/assertions.js";

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("用法: npx tsx eval/grade.ts <session.db> [--transcript <jsonl>] [--scenario <id>]");
  process.exit(1);
}
const tIdx = process.argv.indexOf("--transcript");
const transcriptPath = tIdx > 0 ? process.argv[tIdx + 1] : undefined;
const sIdx = process.argv.indexOf("--scenario");
const scenarioId = sIdx > 0 ? process.argv[sIdx + 1] : undefined;

const db = openDb(dbPath);
const events = eventSince(db, 0);
const pv = buildPlayerView(db);
const stats = toolStats(events);

// CC transcript（jsonl）best-effort 抽 assistant raw 正文（确切结构实现期核实）。
function assistantText(jsonl: string): string {
  const out: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as any;
      const msg = o.message ?? o;
      if ((msg.role ?? o.type) !== "assistant") continue;
      const c = msg.content;
      if (typeof c === "string") out.push(c);
      else if (Array.isArray(c)) for (const part of c) if (part?.type === "text" && part.text) out.push(part.text);
    } catch { /* 跳过非 JSON 行 */ }
  }
  return out.join("\n");
}

const narrateTexts = events.filter((e) => e.kind === "narrate").map((e) => e.content ?? "");
let leak: ReturnType<typeof narrateLeak> | null = null;
let missNarrate: boolean | null = null;
if (transcriptPath) {
  const txt = assistantText(readFileSync(transcriptPath, "utf8"));
  leak = narrateLeak({ assistantText: txt, narrateTexts });
  missNarrate = missingNarrate({ assistantText: txt, narrateCount: narrateTexts.length });
}

// F1 时序（机械）：每条 verdict 的 seq 应早于其后描述它的 narrate（基本检查：是否存在 narrate 在所有 verdict 之前 = 可疑绕过）。
const verdictSeqs = events.filter((e) => e.kind === "verdict").map((e) => e.seq);
const narrateSeqs = events.filter((e) => e.kind === "narrate").map((e) => e.seq);

const report = {
  scenario: scenarioId ?? "(未指定)",
  db: dbPath,
  toolStats: stats,
  narration: pv.narration.map((n) => ({ seq: n.seq, kind: n.kind, preview: n.text.slice(0, 60) })),
  panel: { statusMenu: pv.panel.statusMenu, mechanicalEcho: pv.panel.mechanicalEcho, pendingChoice: pv.panel.pendingChoice ?? null },
  mechanical: {
    narrateLeak: leak,           // null = 未给 transcript
    missingNarrate: missNarrate, // null = 未给 transcript
    verdictCount: verdictSeqs.length,
    narrateCount: narrateSeqs.length,
    gatedVsAuto: `明骰 ${stats.verdictGated} / 暗骰 ${stats.verdictAuto}`,
  },
};

console.log("=== Dicelore GM eval — 机械报告 ===");
console.log(JSON.stringify(report, null, 2));
console.log("\n--- 玩家视图·叙事流 ---");
for (const n of pv.narration) console.log(`[${n.kind}] ${n.text}`);
console.log("\n--- 提示 ---");
console.log("定性评测(对标真人语料):把上面 report + 玩家视图 + transcript + 对应 scenario.reference 桥段喂给 grader(eval/grader.md)。");
if (!transcriptPath) console.log("注:未给 --transcript,narrate 泄漏/漏 narrate 未算(它们需 GM raw 正文)。");

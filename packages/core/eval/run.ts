// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// eval/run.ts — 准备一个 eval 场景的可跑会话：灌种子(rules/sheets/tone) + dicelore init 项目。
// 用法：
//   npx tsx eval/run.ts <scenario-id> --sessions-dir <dir> [--baseline]
//   --baseline：不装 gm-core(裸 Claude 对照),用于 with/without 对比。
// 之后按打印的指引：在 init 出的项目里跑 GM(手动 claude / headless claude -p 喂 playerTurns)，
// 再 `npx tsx eval/grade.ts <db> --transcript <jsonl> --scenario <id>` 评分 → 喂 grader.md 定性对标语料。
import { readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scenarioId = process.argv[2];
if (!scenarioId) {
  console.error("用法: npx tsx eval/run.ts <scenario-id> --sessions-dir <dir> [--baseline]");
  process.exit(1);
}
const sdIdx = process.argv.indexOf("--sessions-dir");
const sessionsDir = sdIdx > 0 ? process.argv[sdIdx + 1] : mkdtempSync(join(tmpdir(), "dl-eval-"));
const baseline = process.argv.includes("--baseline");

interface Scenario {
  id: string; title: string; focus: string[];
  reference: { file: string; beat: string; note: string };
  seed: { tone?: string; rules?: { name: string; content: string }[]; sheets?: { entity: string; attr: string; value: string; show?: boolean }[] };
  playerTurns: string[];
}
const scenario = JSON.parse(readFileSync(join(here, "scenarios", `${scenarioId}.json`), "utf8")) as Scenario;

// env 须在 import core 前设好(openSession 读它定位库)。
process.env.DICELORE_SESSIONS_DIR = sessionsDir;
process.env.DICELORE_SESSION = `eval-${scenario.id}${baseline ? "-baseline" : ""}`;

const { openSession, metaSet } = await import("../src/session/resolve.js");
const { ruleUpsert } = await import("../src/store/rule.js");
const { stateSet } = await import("../src/store/state.js");
const { sheetShow } = await import("../src/store/visibility.js");
const { runInit } = await import("../src/adapter/init.js");

// 1) 灌种子
const { db, path: dbPath } = openSession();
if (scenario.seed.tone) metaSet(db, "tone", scenario.seed.tone);
for (const r of scenario.seed.rules ?? []) ruleUpsert(db, { name: r.name, content: r.content });
for (const s of scenario.seed.sheets ?? []) {
  stateSet(db, s.entity, s.attr, s.value);
  if (s.show) sheetShow(db, s.entity);
}

// 2) init 临时项目
const projectDir = mkdtempSync(join(tmpdir(), "dl-eval-proj-"));
runInit({ projectDir, session: process.env.DICELORE_SESSION });

// init 产的 .mcp.json 是 `npx dicelore mcp`(未发布、本地跑不起来)→ 重写指本地 tsx + 注入 env(同 harness)。
const mcpJsonPath = join(projectDir, ".mcp.json");
const coreMain = join(here, "..", "src", "mcp", "main.ts");
writeFileSync(mcpJsonPath, JSON.stringify({
  mcpServers: {
    dicelore: {
      type: "stdio",
      command: "node",
      args: ["--import", "tsx", coreMain],
      env: { DICELORE_SESSION: process.env.DICELORE_SESSION, DICELORE_SESSIONS_DIR: sessionsDir },
    },
  },
}, null, 2) + "\n");

if (baseline) {
  // baseline = 无 gm-core 影响:去掉 skills + CLAUDE.md 指针。
  rmSync(join(projectDir, ".claude", "skills"), { recursive: true, force: true });
  if (existsSync(join(projectDir, "CLAUDE.md"))) rmSync(join(projectDir, "CLAUDE.md"));
}

console.log(`=== eval 场景已就绪: ${scenario.title} ${baseline ? "[baseline 无skill]" : "[with gm-core]"} ===`);
console.log(`库:       ${dbPath}`);
console.log(`项目:     ${projectDir}`);
console.log(`语料参考: ${scenario.reference.file} — ${scenario.reference.beat}`);
console.log(`重点:     ${scenario.focus.join(" / ")}`);
console.log(`\n玩家输入序列(喂给 GM):`);
scenario.playerTurns.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
console.log(`\n下一步:`);
console.log(`  ① 在项目里跑 GM(择一):`);
console.log(`     - 手动: cd ${projectDir} && DICELORE_SESSIONS_DIR=${sessionsDir} DICELORE_SESSION=${process.env.DICELORE_SESSION} claude  (逐条贴上面输入)`);
console.log(`     - headless: 对每条输入 claude -p(--resume 串起多回合;确切 flag 实现期核实),env 同上`);
console.log(`  ② 评分: npx tsx eval/grade.ts ${dbPath} --transcript <cc-transcript.jsonl> --scenario ${scenario.id}`);
console.log(`  ③ 定性对标: 把 grade 报告 + 玩家视图 + transcript + 上述语料桥段 喂给 grader(eval/grader.md)`);
console.log(`  对比: 再跑一次加 --baseline,比『带 gm-core 是否更接近真人 GM』。`);

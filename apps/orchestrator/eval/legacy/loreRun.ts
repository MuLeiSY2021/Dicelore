// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// eval/loreRun.ts — lore（团本构建）侧 eval 驱动。立即可跑、零 LLM。
//   npx tsx eval/loreRun.ts <lore-scenario-id>
//
// 对称于 dice 侧 run.ts + grade.ts：那边「灌种子→喂 GM playerTurns→runTool→grade」，
// 这边「mock 作者构建指令序列→invokeBuildTool(真构建核心)→commit→import 物化→gradeLoreRun 机械判」。
// 复刻「作者↔构建 GM」交互里**不依赖 LLM 的那一半**——构建工具可用性 + draft→commit→import 映射正确性。
// 「构建 GM 把作者自然语言翻成对的工具调用」那一半（语义、漏域、问对问题）属真 LLM，留待测试（见 eval/loreGrader.md）。
import { runLoreScenario } from "../src/eval/loreScenario.js";
import { gradeLoreRun } from "../src/eval/loreAssertions.js";

const scenarioId = process.argv[2];
if (!scenarioId) {
  console.error("用法: npx tsx eval/loreRun.ts <lore-scenario-id>");
  console.error("（lore 场景在 eval/loreScenarios/，如 frontier-saga）");
  process.exit(1);
}

const run = runLoreScenario(scenarioId);
const report = gradeLoreRun(run);

console.log(`=== Dicelore lore（团本构建）eval — 机械报告: ${run.scenario.title} ===`);

console.log("\n--- 构建指令序列（mock 作者 → 构建工具）---");
run.callResults.forEach(({ call, envelope }, i) => {
  const status = envelope.isError ? "ERROR" : "ok";
  const out = envelope.isError ? (envelope.content?.[0]?.text ?? "") : JSON.stringify(envelope.structuredContent ?? {});
  console.log(`  ${i + 1}. [${status}] dicelore_build_${call.tool}${call.intent ? `  «${call.intent}»` : ""}`);
  console.log(`     → ${out}`);
});

console.log("\n--- 机械评分（零 LLM）---");
console.log(JSON.stringify({
  scenario: report.scenario,
  buildCallsOk: report.buildCallsOk,
  buildErrors: report.buildErrors,
  committed: report.committed,
  commitId: run.commitId,
  importResult: run.importResult,
  counts: report.counts,
  domainFloors: report.domainFloors,
  hasFront: report.hasFront,
  hasPlotline: report.hasPlotline,
  validate: report.validate,
  pass: report.pass,
}, null, 2));

console.log("\n--- 提示 ---");
console.log("本 harness 只判机械可验证的构建管道（工具可用性 + 物化映射），不连 LLM。");
console.log("『构建 GM 是否把作者意图翻成对的工具调用』属语义判断 → 真 LLM 一局留待测试，把本报告 + buildCalls.intent + 真构建 transcript 喂给 grader（eval/loreGrader.md）。");

run.runDb.close();
run.catalog.close();
process.exit(report.pass ? 0 : 1);

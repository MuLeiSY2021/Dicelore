// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// lore 侧 eval 场景共享逻辑：LoreScenario 类型 + loadLoreScenario + runLoreScenario(offline 驱动)。
//
// ── 与 dice 侧的对称关系（src/eval/scenario.ts）─────────────────────────────
//   dice eval：prepareSessionDb 灌种子 → playerTurns 喂 GM → runTool 驱真引擎 → assertions/grade 判。
//   lore eval：buildAuthorCtx 建 Draft+Catalog → buildCalls 喂「构建工具序列」→ invokeBuildTool 驱真构建核心
//              → commit → importPack 物化到运行库 → loreAssertions 判运行库内容。
//
// ── offline 复刻「作者↔构建 GM」的哪一半 ────────────────────────────────────
//   真实构建是「作者用自然语言 ↔ 构建 GM(LLM) 决定调哪些 dicelore_build_* 工具」。这里把 **LLM 决策那一半**
//   换成「确定性 mock 作者」——场景里**预设好构建工具调用序列**(buildCalls)，不连真 LLM。于是本 harness
//   机械可验证的是「构建工具可用性 + draft→commit→CSV/md→import 物化映射」这条**确定性管道**是否正确：
//   作者声明了 front/plotline/foreshadow/anchor/pool/state…，commit 后 import，运行库里这些域真到位吗？
//   「构建 GM 把作者自然语言翻成对的工具调用」那一半（语义、是否漏域、是否问对问题）属真 LLM，留待测试（见 eval/loreGrader.md）。
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openCatalog, type CatalogDB } from "../catalog/db.js";
import { openDb, initSchema, type DB } from "../store/db.js";
import { importPack, type ImportResult } from "../catalog/import.js";
import { resolveId } from "../catalog/catalog.js";
import { Draft } from "../build/draft.js";
import { invokeBuildTool, type BuildCtx, type BuildEnvelope } from "../build/buildMcp.js";

const here = dirname(fileURLToPath(import.meta.url));
// lore scenarios 在 packages/core/eval/loreScenarios/（src/eval → ../../eval/loreScenarios）。
const loreScenariosDir = join(here, "..", "..", "eval", "loreScenarios");

// 一条 mock 作者的构建指令 = 一次 dicelore_build_* 工具调用（工具名去 dicelore_build_ 前缀）。
export interface BuildCall {
  tool: string;
  args?: unknown;
  // 可选：标这一步「作者意图」的自然语言（仅文档/报告用，不参与机械判定；对标真 LLM 时用）。
  intent?: string;
}

// 机械断言期望：import 物化后运行库里各域应至少有几行（缺省=不施加该域地板）。
// 都是确定性、零 LLM 可判——只数运行库行数 / 查特定行存在性。
export interface LoreExpects {
  lore?: number;        // 物化后 lore 表 ≥ 此值
  rules?: number;       // rule 表 ≥
  pools?: number;       // pool 表 ≥
  stateCells?: number;  // state 表（含 front Clock 初始化格）≥
  fronts?: number;      // front 表 ≥
  plotlines?: number;   // plotline 表 ≥
  foreshadows?: number; // foreshadow 表 ≥
  anchors?: number;     // anchor 表 ≥
  watchers?: number;    // watcher 表（front 凶兆阶梯预声明）≥
  // 期望 validate（commit 前 draft.validate）通过（坏包 → fail）。缺省=不检查。
  validatePasses?: boolean;
  // 期望存在的具体运行库行（精确点检，比纯计数更强）：
  //   front:    指定 id 的 front 行应存在；
  //   plotline: 指定 id 的 plotline 行应存在。
  hasFront?: string[];
  hasPlotline?: string[];
}

export interface LoreScenario {
  id: string;
  title: string;
  // 本场景重点验证的构建侧失败模式（如「叙事域漏物化」「CSV 列映射错位」）。报告/grader 参考。
  focus: string[];
  // 团本名（决定 Catalog UUIDv5 身份 + commit 路由）。
  adventure: string;
  // mock 作者预设的构建指令序列（确定性，不连 LLM）。
  buildCalls: BuildCall[];
  // 机械地板期望（loreAssertions 读它做确定性判定，零 LLM）。
  expects?: LoreExpects;
}

export function loadLoreScenario(scenarioId: string): LoreScenario {
  return JSON.parse(readFileSync(join(loreScenariosDir, `${scenarioId}.json`), "utf8")) as LoreScenario;
}

// 建一个 offline 构建上下文：内存 Catalog + 空 Draft（源摄入已退役 BM25 检索，改会话工作区 materials/ + agentic 文件处理）。
export function buildAuthorCtx(adventure: string): { ctx: BuildCtx; catalog: CatalogDB } {
  const catalog = openCatalog(":memory:");
  const ctx: BuildCtx = { catalog, draft: new Draft(), name: adventure };
  return { ctx, catalog };
}

export interface LoreRunResult {
  scenario: LoreScenario;
  // 每条构建指令的 envelope（结构化结果 / 错误）；与 buildCalls 一一对应。
  callResults: { call: BuildCall; envelope: BuildEnvelope }[];
  commitId?: string;       // commit 工具产出的 commitId（若场景含 commit）。
  importResult?: ImportResult; // import 物化结果（若已 commit）。
  runDb: DB;               // 物化后的运行库（assertions 查它）。
  catalog: CatalogDB;
}

// offline 驱动一条 lore 场景：mock 作者指令序列 → invokeBuildTool（真构建核心）→ commit → importPack 物化。
// 不连任何 LLM。commit 之后用 commitId 物化进新建的运行库。
export function runLoreScenario(scenarioId: string): LoreRunResult {
  const scenario = loadLoreScenario(scenarioId);
  const { ctx, catalog } = buildAuthorCtx(scenario.adventure);

  const callResults: { call: BuildCall; envelope: BuildEnvelope }[] = [];
  let commitId: string | undefined;
  for (const call of scenario.buildCalls) {
    const envelope = invokeBuildTool(ctx, call.tool, call.args ?? {});
    callResults.push({ call, envelope });
    if (call.tool === "commit" && !envelope.isError) {
      const sc = envelope.structuredContent as { commitId?: string } | undefined;
      commitId = sc?.commitId;
    }
  }

  // import 物化（仅当场景里 commit 成功）。新建独立运行库。
  const runDb = openDb(":memory:");
  initSchema(runDb);
  let importResult: ImportResult | undefined;
  if (commitId) {
    importResult = importPack(catalog, runDb, resolveId(scenario.adventure), commitId);
  }
  return { scenario, callResults, commitId, importResult, runDb, catalog };
}

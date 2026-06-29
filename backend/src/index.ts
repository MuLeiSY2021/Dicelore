// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/backend 公共面（store 一族引擎层 barrel；显式手写 re-export，不用 auto export*）。
// 这些行原样搬自 @dicelore/core 的旧 barrel（仅保留 re-export 自 9 个被迁模块 store/expr/
// resolve/present/catalog/build/toolgen/eval/session 的部分）；core 经裸 @dicelore/backend 转出。
export { openDb, initSchema, type DB } from "./store/db.js";
export { initViews } from "./store/views.js";
// 声明式工具生成层接线（叙事层 dogfooding，spec §8 + DT-9 step③）
export { toolgenToToolDef } from "./toolgen/toToolDef.js";
export {
  buildPresentationModel,
  type PresentationModel,
  type EchoEntry,
  type VisibleCell,
  type ChoiceView,
} from "./present/model.js";

// 玩家闸控明骰原语（供 orchestrator / 组件7 注入 gate、触发 commit）。
export {
  stagePendingRoll,
  getPendingRoll,
  type PendingRollRow,
  type RollSpec,
  type RollShape,
} from "./store/pendingRoll.js";
export { commitPendingRoll, type RollResult } from "./resolve/commitRoll.js";

// eval 场景准备（run.ts 手动调试 + orchestrator harness 自动闭环共用）。
export { loadScenario, prepareSessionDb, type Scenario, type PreparedSession } from "./eval/scenario.js";
// eval 地板判定（core 侧 integration/harness.test 经 barrel 消费；offline 驱动自测）。
export {
  rollFloor,
  closureFloor,
  type RollFloorExpect,
  type RollFloorResult,
  type ClosureFloorExpect,
  type ClosureFloorResult,
} from "./eval/assertions.js";

// ===== Catalog 团本包库（后端双路径架构 P2）=====
export {
  openCatalog, type CatalogDB, uuidv5, resolveId, commit, history, checkout, tag, list,
  type PackFile, type CommitRow, type TuanbenSummary,
} from "./catalog/index.js";
// import 信任闸门 + 建库（P3）
export { importPack, validatePack, type ImportResult, type ImportIssue } from "./catalog/index.js";
// git 单向投影（P4）
export { exportGit, importGit } from "./catalog/index.js";

// ===== 团本构建层（P5）=====
export { Draft, commitDraft, type StateCell } from "./build/draft.js";
export { createBuildMcpServer, invokeBuildTool, type BuildCtx, BUILD_SCHEMAS } from "./build/buildMcp.js";

// ===== 运行时只读浏览（组件7 跑团页左活动轨自查源；additive 只读，不改引擎） =====
export { loreSearch, loreGet, type Lore } from "./store/world.js";
export { ruleSearch, ruleGet, type Rule } from "./store/rule.js";
export { logSince, logRecall, type LogRow } from "./store/record.js";
export { stateList, stateGet, type StateCell as RuntimeStateCell } from "./store/state.js";
// session_meta KV(团本名/prologue/started 等,P2 Play 生命周期) + 路径规则(sessionDbPath/openSession)。
// 后端 server.ts 与 eval prepareSessionDb 共用 openSession 路径规则,避免种子灌到 core 路径而后端开平铺空库。
export { metaGet, metaSet, sessionDbPath, sessionDir, openSession, type SessionKind } from "./session/resolve.js";

// ===== 回合快照（SNAP-1 / ADR-0017 v1：自动持久化、存档/读档）=====
// orchestrator turnEnd 调 checkpoint、/rewind 端点调 restore+latestSnapshot；participant 注册表供客制域接入。
export {
  checkpoint,
  restore,
  latestSnapshot,
  listSnapshots,
  registerSnapshotParticipant,
  defaultParticipants,
  tableParticipant,
  type SnapshotParticipant,
  type SnapshotRow,
  type CheckpointOpts,
} from "./store/snapshot.js";

// ===== token 用量计量(CO-采集 / store/usage.ts)=====
// DiceGm 消费到 result.usage → recordUsage 落库;查询按 turn/agent/session 聚合(可视化另起 CO-前端线)。
export {
  recordUsage,
  listUsage,
  usageByTurn,
  usageByAgent,
  usageBySession,
  type UsageInput,
  type UsageRow,
  type UsageTotals,
} from "./store/usage.js";

// ===== core 侧 mcp/adapter/cli/main 经裸 @dicelore/backend 消费、但不在上面公共面里的补充符号 =====
// adapter/turnEnd.ts 用 logAppend（store/record）+ getPendingChoice/materializePendingChoice（store/choice）。
export { logAppend, type LogKind, type LogInput } from "./store/record.js";
export {
  stagePendingChoice,
  getPendingChoice,
  materializePendingChoice,
  type ChoiceOption,
} from "./store/choice.js";

// ===== core 侧集成测试（integration/import.test.ts）经 barrel 消费的引擎符号 =====
// 这些原是 backend 内部相对 import；集成测试移到 core 后必须经包入口拿，故在此显式转出。
export { watcherList, type WatcherRow } from "./store/watcher.js";
export { foreshadowList, type Foreshadow } from "./store/foreshadow.js";
export { stateSet } from "./store/state.js";
export { parseFront, type ParsedFront } from "./build/pack/validate.js";

// ===== core 侧 mcp 工具面（handlers/stdlib）经裸 @dicelore/backend 直接消费的引擎符号 =====
// mcp/handlers 与 mcp/stdlib 紧贴 store/resolve/toolgen 引擎；store 一族迁出后这些 import 全改裸 barrel。
export { worldRegister, poolSample, loreUpsert } from "./store/world.js";
export { ruleUpsert } from "./store/rule.js";
export { frontList } from "./store/front.js";
export { plotlineList } from "./store/plotline.js";
export { applyMutations } from "./store/mutate.js";
export { truncateText } from "@dicelore/interface";
export { sheetShow, worldShow, revealOnce } from "./store/visibility.js";
export { watcherSet, recomputeWatchers } from "./store/watcher.js";
export { makeEvalCtx } from "./store/evalCtx.js";
export { resolveContest } from "./resolve/contest.js";
export { type ToolDecl } from "./toolgen/compile.js";

// ===== storage-port 端口实现(阶段3，纯加法) =====
// openSessionBackend(db) 组装 SessionBackend(Store & Resolver & Meta)；接口契约 + 域类型在 @dicelore/interface。
export { openSessionBackend } from "./sessionBackend.js";
export type { SessionBackend, Store, Resolver, Meta } from "@dicelore/interface";

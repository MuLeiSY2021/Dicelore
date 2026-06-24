// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/core 公共面（additive；引擎纯逻辑反向零 import 本文件）。
export { openDb, initSchema, type DB } from "./store/db.js";
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
export { setRollGate, getRollGate, type RollGate } from "./mcp/rollGate.js";

// in-process MCP 工厂 + 写后回调接缝（组件7 orchestrator 用）。
export {
  createMcpServer,
  type CanonWriteEvent,
  type McpServerDeps,
} from "./mcp/server.js";
export { TOOLS } from "./mcp/tools.js"; // 工具清单（组件7 配置页展示真实工具数）

// 回合末 hook（choice 物化 + L3 审计）——组件4，供 orchestrator turn-end 复用。
export { runTurnEnd } from "./adapter/turnEnd.js";

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
export { logSince, logRecall, type LogRow } from "./store/log.js";
export { stateList, stateGet, type StateCell as RuntimeStateCell } from "./store/state.js";
// session_meta KV(团本名/prologue/started 等,P2 Play 生命周期)
export { metaGet, metaSet } from "./session/resolve.js";
export { buildSessionContext } from "./adapter/sessionContext.js";

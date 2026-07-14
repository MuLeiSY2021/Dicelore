// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/interface/domain —— SessionBackend 方法面引用的「域类型」(type-only)。
//
// 这些类型原定义在 backend 的 store/resolve/expr 模块里。storage-port 要求端口接口
// (SessionBackend) 落在中立的 interface 包，而它的方法签名引用一批域类型；若让 interface
// import backend 取这些类型，interface↔backend 即成环。故把**方法面真正用到的**域类型下沉至此
// (type-only，零行为)，backend 的原模块改为从此处 import 并 re-export，对其公共面零影响。
//   依赖方向：backend → interface（合法）、interface → @dicelore/dice（叶子包，合法），无环。
// 见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028(决策②③)。

import type { Rng } from "@dicelore/dice";
// ToolDef 定义在 index.ts(MCP 工具契约)；ImportResult.toolDefs 引用它。type-only import,无运行时环。
import type { ToolDef } from "./index.js";

// ===== store/state =====
export type StateKind = "player" | "npc" | "world";

export interface StateCell {
  entity: string;
  attr: string;
  value: string;
  visible: number;
  kind: StateKind;
  rel_object: string | null;
  rel_dim: string | null;
  clock_min: number | null;
  clock_max: number | null;
  clock_mode: string | null;
}

// ===== store/mutate =====
export type MutOp = "+" | "-" | "=";

export interface Mutation {
  attr: string;
  op: MutOp;
  expr: string;
}

export interface MutationApplied {
  attr: string;
  op: MutOp;
  expr: string;
  kind: "rolled" | "set";
  old: string | null;
  rolls?: number[];
  delta?: number;
  new: string;
}

export interface MutationResult {
  entity: string;
  applied: MutationApplied[];
  fired_watchers: { id: number; payload: string }[];
  event_id: number;
}

// ===== store/record (event log) =====
export type LogKind = "narrate" | "verdict" | "mutation" | "note" | "watcher_fired" | "reveal" | "choice";

export interface LogInput {
  content?: string;
  kind: LogKind;
  data_json?: unknown;
  tags?: string;
  visible?: number;
  game_time?: string;
  is_moment?: number;
}

export interface LogRow {
  seq: number;
  content: string | null;
  kind: LogKind;
  data_json: string | null;
  tags: string | null;
  visible: number;
  game_time: string | null;
  is_moment: number;
  created_at: string;
}

// ===== store/watcher =====
export interface WatcherRow {
  id: number;
  condition: string;
  payload: string;
  mode: "once" | "repeat";
  armed: number;
  status: string;
  source: string;
  last_fired_seq: number | null;
}

// ===== store/world (lore) =====
export interface Lore {
  rowid: number;
  name: string;
  content: string;
  category: string | null;
  tags: string | null;
  visible: number;
}

// ===== store/visibility =====
export type RevealTarget =
  | { kind: "sheet"; entity: string; attr: string }
  | { kind: "lore"; rowid: number };

// ===== store/rule =====
export interface Rule {
  rowid: number;
  name: string;
  content: string;
  category: string | null;
  version: number;
}

// ===== store/choice =====
export interface ChoiceOption {
  label: string;
  consequence: string;
}

// ===== store/pendingRoll =====
export type RollShape = "outcome" | "contest";
export interface RollSpec {
  context: string;
  die?: string;
  bands?: unknown[];
  a?: unknown;
  b?: unknown;
}

// pendingRoll 行（getPendingRoll 端口方法返回）。原住 backend/store/pendingRoll.ts，
// 因 Store 端口新增 getPendingRoll(eventId) 而下沉至此（backend 侧 re-export 保持公共面）。
export interface PendingRollRow {
  eventId: number;
  shape: RollShape;
  spec: RollSpec;
  status: "awaiting" | "committed";
  verdictSeq: number | null;
}

// ===== expr/parse + expr/evaluate (被 ContestResult 引用) =====
export type TermKind = "dice" | "int" | "ref";

export interface ExprTerm {
  kind: TermKind;
  raw: string;
  sign: 1 | -1;
  rolls?: number[];
  refValue?: number;
  value: number;
}

export interface ExprLedger {
  total: number;
  terms: ExprTerm[];
}

// ===== resolve/contest =====
export interface ContestSide {
  name: string;
  ledger: ExprLedger;
}
export interface ContestResult {
  a: ContestSide;
  b: ContestSide;
  winner: "a" | "b" | "tie";
}

// ===== resolve/commitRoll =====
export type RollResult =
  | {
      eventId: number;
      shape: "outcome";
      verdictSeq: number;
      roll: number;
      die: string;
      band: { label: string; consequence: string };
    }
  | {
      eventId: number;
      shape: "contest";
      verdictSeq: number;
      a: { name: string; total: number; rolls: number[] };
      b: { name: string; total: number; rolls: number[] };
      winner: "a" | "b" | "tie";
    };

// Rng 出现在若干 resolver/store 方法的可选 rng 参数里(测试注入种子)；从 @dicelore/dice 透出，
// 供 SessionBackend 方法签名引用，使 interface 不必反向 import backend。
export type { Rng };

// ===== store/snapshot (Snapshots 端口) =====
export interface SnapshotRow {
  id: number;
  parentId: number | null;
  turnStartSeq: number | null;
  turnEndSeq: number | null;
  createdAt: string;
}
export interface CheckpointOpts {
  /** 本回合末 log seq（turn_end_seq）。 */
  turnSeq: number;
  /** TR3 additive：本回合末对应的 transcript 节点 uuid（落 transcript_anchor 列，供 restoreToAnchor 反查）。 */
  anchorUuid?: string;
}

// ===== present/model (Presentation 端口) =====
export interface EchoEntry { seq: number; kind: "verdict" | "mutation" | "watcher_fired"; text: string }
export interface VisibleCell { entity: string; attr: string; value: string }
export interface ChoiceView { prompt: string; options: { label: string; consequence: string }[]; seq: number }
export interface PresentationModel {
  mechanicalEcho: EchoEntry[];
  statusMenu: VisibleCell[];
  pendingChoice?: ChoiceView;
}

// ===== store/usage (Usage 端口：token 计量落库) =====
/** 一条 usage 计量输入（DiceSession 在回合末经端口 recordUsage 落库）。
 *  原住 backend/store/usage.ts，因 recordUsage 进端口而下沉至此（backend 侧 re-export 保持公共面）。 */
export interface UsageInput {
  sessionId: string;
  turnId: string;
  agent: string; // 归因标签：'gm' / 'build' / …（per-agent 维度）
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

// ===== catalog/import (Catalog 端口) =====
/** 包校验 issue（与 backend ValidateIssue 同构）。 */
export interface ImportIssue { level: "error" | "warn"; file: string; msg: string; hint?: string }
export interface ImportResult {
  lore: number; rules: number; pools: number; stateCells: number;
  fronts: number; plotlines: number; foreshadows: number; anchors: number;
  prologue?: string;
  adventureName?: string;
  /** 作者面声明式工具编译产出(DT-9)——回传供 createMcpServer 经 extraTools 注入。 */
  toolDefs: ToolDef[];
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/interface/backend —— storage-port 的端口接口 SessionBackend(依赖倒置中立契约)。
//
// 将来 mcp/adapter 经此接口(注入)调存储、不再直接 import @dicelore/backend，从而能断
// backend↔harness 环；后端实现可加 cache / 远程 / 多租户。本阶段为**纯加法**：接口 + 实现就位、
// typecheck 通过即可，现有消费者仍直接 import backend 不变。
//
// 命名约定(项目)：接口按领域概念命名，**不带 Port/I 后缀**。每个会话拿到一个 db 已绑定的实例
// (openSessionBackend(db))；故所有方法都**不收 db 参**——db 由实现闭包捕获。
// 分组对应 ADR §3 的几束(Store / Resolver / Snapshots / Catalog / Presentation / Meta / Toolgen)；
// 本阶段实现并圈定 mcp/adapter/integration 真正消费到的那一束(Store / Resolver / Meta)，其余
// 束(Snapshots / Catalog / Presentation / Toolgen)随消费者迁经端口时再长出。
// 见 docs/重构/ADR-storage-port.md §3/§4。

import type {
  StateCell,
  StateKind,
  Mutation,
  MutationResult,
  LogInput,
  LogRow,
  WatcherRow,
  Lore,
  Rule,
  ChoiceOption,
  RollShape,
  RollSpec,
  RollResult,
  ContestResult,
  RevealTarget,
  Rng,
} from "./domain.js";

/** sheet / event(log) / world / rule / watcher / pendingChoice / pendingRoll / mutations —— 会话存储的读写面。 */
export interface Store {
  // --- state (角色卡 / 实体属性) ---
  stateGet(entity: string, attr: string): StateCell | undefined;
  stateList(prefix: string): StateCell[];
  stateSet(
    entity: string,
    attr: string,
    value: string,
    visible?: number,
    kind?: StateKind,
  ): void;
  applyMutations(
    entity: string,
    mutations: Mutation[],
    opts?: { rng?: Rng; kind?: StateKind },
  ): MutationResult;

  // --- event log (事件流) ---
  logAppend(ev: LogInput): number;
  logSince(sinceSeq: number): LogRow[];
  logRecall(query: string, opts?: { limit?: number }): LogRow[];

  // --- watcher (条件触发器) ---
  watcherSet(opts: {
    condition: string;
    payload: string;
    mode?: "once" | "repeat";
    created_seq?: number;
    source?: string;
  }): number;
  watcherList(): WatcherRow[];
  /** 写后就地比对、edge-triggered；内部自建 EvalCtx(db 已绑定)。 */
  recomputeWatchers(): { id: number; payload: string }[];

  // --- visibility (揭示) ---
  sheetShow(entity: string, attr?: string): number;
  worldShow(table: "lore" | "pool", rowid: number): number;
  revealOnce(target: RevealTarget): number;

  // --- world (lore / pool) ---
  loreGet(name: string): Lore | undefined;
  loreSearch(query: string, limit?: number): Lore[];
  loreUpsert(d: {
    name: string;
    content: string;
    category?: string;
    tags?: string;
    visible?: number;
  }): number;
  worldRegister(a: {
    pool: string;
    row: Record<string, unknown>;
    weight?: number;
    visible?: number;
  }): number;
  poolSample(
    pool: string,
    n: number,
    opts?: { filter?: Record<string, string | number>; rng?: Rng },
  ): Record<string, unknown>[];

  // --- rule (只读) ---
  ruleSearch(query: string, limit?: number): Rule[];

  // --- pendingChoice (暂存选项) ---
  stagePendingChoice(prompt: string, options: ChoiceOption[]): void;
  getPendingChoice():
    | { prompt: string; options: ChoiceOption[]; status: string }
    | undefined;
  materializePendingChoice(): number | undefined;

  // --- pendingRoll (明骰暂存) ---
  stagePendingRoll(input: { shape: RollShape; spec: RollSpec }): number;
}

/** 裁决：对抗骰求值 + 明骰提交(单骰串 resolveOutcome 无 db、属纯函数，不进端口)。 */
export interface Resolver {
  resolveContest(
    a: { name: string; expr: string },
    b: { name: string; expr: string },
    rng?: Rng,
  ): ContestResult;
  commitPendingRoll(eventId: number, rng?: Rng): RollResult;
}

/** session_meta KV。 */
export interface Meta {
  metaGet(key: string): string | undefined;
  metaSet(key: string, value: string): void;
}

/**
 * 一个会话的存储端口聚合(db 已绑定)。ADR §3 的端口表面；
 * 本阶段聚合已圈定的 Store / Resolver / Meta 三束(mcp/adapter/integration 实际消费面)。
 * Snapshots / Catalog / Presentation / Toolgen 束待相应消费者迁经端口时并入。
 */
export type SessionBackend = Store & Resolver & Meta;

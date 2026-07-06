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
// mcp/adapter 经此接口(注入)调存储、不直接 import @dicelore/backend，从而断 backend↔harness
// 环；后端实现可加 cache / 远程 / 多租户。接线已定稿(ADR-0028)：harness(DiceSession/createMcpServer)
// 收注入的 SessionBackend、所有存储读写经它，组合根 backend/server.ts 按会话 openSessionBackend(db) 注入。
//
// 命名约定(项目)：接口按领域概念命名，**不带 Port/I 后缀**。每个会话拿到一个 db 已绑定的实例
// (openSessionBackend(db))；故所有方法都**不收会话 db 参**——db 由实现闭包捕获(唯一例外 Catalog.importPack
// 收外部团本库句柄 catalogDB 作业务入参)。
// 端口聚合全部束：Store / Resolver / Meta / Usage / Snapshots / Presentation / Catalog。
// Toolgen 束(toolgenToToolDef)经 2026-06-29 归属判断划为 backend 资产、不进端口。
// 见 docs/wiki/05-决策记录-ADR/README.md ADR-0028(决策②③④)。

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
  PendingRollRow,
  ContestResult,
  RevealTarget,
  Rng,
  SnapshotRow,
  CheckpointOpts,
  PresentationModel,
  ImportResult,
  UsageInput,
} from "./domain.js";
import type { DB } from "./index.js";

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
  /** 读一条 pending_roll 行（明骰 gate 据 eventId 查规格 / 重启恢复路判存在后立即掷）。 */
  getPendingRoll(eventId: number): PendingRollRow | undefined;
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

/** token 用量计量（DiceSession 回合末经端口落库；db 已绑定）。
 *  DiceGm 适配器只 parseUsage 经 TurnEvent 上抛、不碰存储；落库由会话经此端口做（ADR §3 Usage 束）。 */
export interface Usage {
  recordUsage(u: UsageInput): number;
}

/** 回合快照(SNAP-1 / ADR-0017)：自动持久化、存档/读档。db 已绑定;不暴露自定义 participant(默认集)。 */
export interface Snapshots {
  /** 回合边界落一份全量快照,返回 snapshot id。 */
  checkpoint(opts: CheckpointOpts): number;
  /** 恢复到指定快照(默认 participant 集)。 */
  restore(snapshotId: number): void;
  /** TR3 additive：按 transcript 节点 uuid 反查快照并整表覆写（找不到锚点抛 no_snapshot_for_anchor）。 */
  restoreToAnchor(uuid: string): void;
  /** 最近一份快照(无则 undefined)。 */
  latestSnapshot(): SnapshotRow | undefined;
  /** 按 id 升序列出全部快照。 */
  listSnapshots(): SnapshotRow[];
}

/** 玩家视角展示模型(机械回声 / 状态菜单 / 待决选项)。db 已绑定。 */
export interface Presentation {
  buildPresentationModel(opts?: { turnStartSeq?: number }): PresentationModel;
}

/** 开局物化：从 Catalog(团本包库)checkout 选定版本 → 本局运行库(信任闸门重验)。
 *  runDB 为端口实例已绑定的会话库;catalogDB 是外部团本库句柄(每次 import 传入)。 */
export interface Catalog {
  importPack(catalogDB: DB, adventureId: string, ref: string): ImportResult;
}

/**
 * 一个会话的存储端口聚合(db 已绑定)。ADR §3 的端口表面；
 * 聚合 Store / Resolver / Meta(基础读写) + Usage(计量) + Snapshots / Presentation / Catalog(随消费者迁经端口长出)。
 * Toolgen 束(toolgenToToolDef)经判定为 backend 资产、不进端口(归属判断 2026-06-29 B)。
 */
export type SessionBackend = Store &
  Resolver &
  Meta &
  Usage &
  Snapshots &
  Presentation &
  Catalog;

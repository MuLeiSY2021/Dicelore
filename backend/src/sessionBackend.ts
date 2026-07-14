// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// openSessionBackend —— storage-port 端口接口 SessionBackend 的 backend 侧实现(组合根)。
//
// 把 store/resolve/session 的现有自由函数用闭包绑定 db、组装成一个对象，满足
// @dicelore/interface 的 SessionBackend(Store & Resolver & Meta & Usage & Snapshots &
// Presentation & Catalog)。一个会话一个实例。
// 接线已定稿(ADR-0028)：harness(DiceSession/createMcpServer)经注入的 SessionBackend 端口访存，
// 不再直接 import 这些自由函数；openSessionBackend 是 harness 经端口访存的唯一实现，
// 由组合根(server.ts/main.ts/hooks)按会话注入。
// 见 wiki/开发指南/03-架构/总体架构.md「决策与权衡」节 ADR-0028。

import type { DB, SessionBackend } from "@dicelore/interface";

import { stateGet, stateList, stateSet } from "./store/sheet/state.js";
import { applyMutations } from "./store/sheet/mutate.js";
import { logAppend, logSince, logRecall } from "./store/event/record.js";
import { watcherSet, watcherList, recomputeWatchers } from "./store/narrative/watcher.js";
import { makeEvalCtx } from "./store/evalCtx.js";
import { sheetShow, worldShow, revealOnce } from "./store/sheet/visibility.js";
import { loreGet, loreSearch, loreUpsert, worldRegister, poolSample } from "./store/world/world.js";
import { ruleSearch } from "./store/world/rule.js";
import {
  stagePendingChoice,
  getPendingChoice,
  materializePendingChoice,
} from "./store/interaction/choice.js";
import { stagePendingRoll, getPendingRoll } from "./store/interaction/pendingRoll.js";
import { resolveContest } from "./resolve/contest.js";
import { commitPendingRoll } from "./resolve/commitRoll.js";
import { metaGet, metaSet } from "./session/resolve.js";
import { recordUsage } from "./store/usage.js";
import { checkpoint, restore, restoreToAnchor, latestSnapshot, listSnapshots } from "./store/snapshot.js";
import { buildPresentationModel } from "./present/model.js";
import { importPack } from "./catalog/import.js";

/** 构造一个 db 已绑定的会话存储端口实现。 */
export function openSessionBackend(db: DB): SessionBackend {
  return {
    // ===== Store: state =====
    stateGet: (entity, attr) => stateGet(db, entity, attr),
    stateList: (prefix) => stateList(db, prefix),
    stateSet: (entity, attr, value, visible, kind) =>
      stateSet(db, entity, attr, value, visible, kind),
    applyMutations: (entity, mutations, opts) => applyMutations(db, entity, mutations, opts),

    // ===== Store: event log =====
    logAppend: (ev) => logAppend(db, ev),
    logSince: (sinceSeq) => logSince(db, sinceSeq),
    logRecall: (query, opts) => logRecall(db, query, opts),

    // ===== Store: watcher =====
    watcherSet: (opts) => watcherSet(db, opts),
    watcherList: () => watcherList(db),
    recomputeWatchers: () => recomputeWatchers(db, makeEvalCtx(db)),

    // ===== Store: visibility =====
    sheetShow: (entity, attr) => sheetShow(db, entity, attr),
    worldShow: (table, rowid) => worldShow(db, table, rowid),
    revealOnce: (target) => revealOnce(db, target),

    // ===== Store: world =====
    loreGet: (name) => loreGet(db, name),
    loreSearch: (query, limit) => loreSearch(db, query, limit),
    loreUpsert: (d) => loreUpsert(db, d),
    worldRegister: (a) => worldRegister(db, a),
    poolSample: (pool, n, opts) => poolSample(db, pool, n, opts),

    // ===== Store: rule =====
    ruleSearch: (query, limit) => ruleSearch(db, query, limit),

    // ===== Store: pendingChoice =====
    stagePendingChoice: (prompt, options) => stagePendingChoice(db, prompt, options),
    getPendingChoice: () => getPendingChoice(db),
    materializePendingChoice: () => materializePendingChoice(db),

    // ===== Store: pendingRoll =====
    stagePendingRoll: (input) => stagePendingRoll(db, input),
    getPendingRoll: (eventId) => getPendingRoll(db, eventId),

    // ===== Resolver =====
    resolveContest: (a, b, rng) => resolveContest(db, a, b, rng),
    commitPendingRoll: (eventId, rng) => commitPendingRoll(db, eventId, rng),

    // ===== Meta =====
    metaGet: (key) => metaGet(db, key),
    metaSet: (key, value) => metaSet(db, key, value),

    // ===== Usage =====
    recordUsage: (u) => recordUsage(db, u),

    // ===== Snapshots =====
    checkpoint: (opts) => checkpoint(db, opts),
    restore: (snapshotId) => restore(db, snapshotId),
    restoreToAnchor: (uuid) => restoreToAnchor(db, uuid),
    latestSnapshot: () => latestSnapshot(db),
    listSnapshots: () => listSnapshots(db),

    // ===== Presentation =====
    buildPresentationModel: (opts) => buildPresentationModel(db, opts ?? {}),

    // ===== Catalog =====
    importPack: (catalogDB, adventureId, ref) => importPack(catalogDB, db, adventureId, ref),
  };
}

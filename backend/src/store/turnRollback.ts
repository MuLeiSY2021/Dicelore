// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

// ===== RT-1 中期：回合级事务回滚原语（轻量 DELETE，非快照 restore）=====
//
// 背景（backlog-后端 RT-1）：GM 超时兜底现为「脱困不恢复」——超时/error 触发 abort 后
// turnLoop 裸 return，已落库的 log/state 变更不撤回、半条 narration_commit 已发给前端。
// 本原语提供 core 回合级回滚：回合开始前记 turn_start_seq，超时/error 时把本回合落的
// log 段删净，并尽力把本回合的 sheet（state 表）变更逆回起点态。
//
// 设计约束（已裁决）：
//   - 走轻量 DELETE（log WHERE seq > start），不做快照 restore（v2 与 SNAP-1 合并，见路线图第三批）。
//   - 不新增 db.ts schema —— log 表已存（seq INTEGER PRIMARY KEY AUTOINCREMENT，删除精确）。
//   - state 表无 per-row seq 锚点，本不可由 log 段直接定位逆运算；但 sheet/mutate.ts 落的
//     kind="mutation" 事件 data_json.applied[] 已记录每次变更的 {entity, attr, old, new}，
//     故 state 可由这些 mutation 事件按 seq 逆序回放 old 值精确撤回（best-effort）。
//   - 其余在回合内被改动、但无可逆信号的副作用表（watcher 运行时态、pending_roll 挂起的明骰、
//     snapshot 等）本原语不碰 —— 这些残余进 report.residue 冒泡，由上层（turnLoop / 端点）决定
//     是否提示「GM 半途被杀，下列副作用未自动回滚」。长期 v2 用 checkpoint/restore 一并兜底。

/** 回合起点 = 当前全局 log MAX(seq)（与 turnLoop turn_ended.seq、§1 快照 narrativeCursor 同口径）。空 log → 0。 */
export function turnStartSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  return r.s ?? 0;
}

export interface RollbackReport {
  /** 删掉的 log 行数（seq > startSeq 的本回合段）。 */
  deletedLogCount: number;
  /** 精确逆回的 state 单元变更条数（来自本回合 mutation 事件的 applied 项）。 */
  stateReverted: number;
  /**
   * 无法由本原语精确逆的副作用残余，每条一句人读描述（如「pending_roll: 1 行回合内挂起的明骰未回滚」）。
   * 非空即提示上层：轻量回滚已尽力，但下列态需人工或 v2 快照兜底。绝不静默吞掉。
   */
  residue: string[];
}

// mutation 事件 data_json 形状（与 sheet/mutate.ts logAppend 落的口径对齐；只取回滚需要的字段）。
interface MutationApplied {
  attr: string;
  old: string | null; // 变更前值；null = 该单元在此变更前不存在（逆 = 删行）
}
interface MutationData {
  entity: string;
  applied: MutationApplied[];
}

/**
 * 回滚本回合：删 log WHERE seq > startSeq，并尽力逆回本回合 sheet 变更回起点态。
 * 单事务原子完成（任一步失败整体回滚，不留半态）。返回 report 供上层冒泡残余。
 */
export function rollbackAfterSeq(db: DB, startSeq: number): RollbackReport {
  const tx = db.transaction((): RollbackReport => {
    // 1) 先据本回合的 mutation 事件逆序回放 state（必须在删 log 前读到它们）。
    //    倒序（seq DESC）逐条把每个单元还原到该次变更前的 old —— 同一单元被改多次时，
    //    最后回放的是最早那次的 old，即起点值。old=null → 该单元起点不存在 → 删行。
    const mutationRows = db
      .prepare("SELECT data_json FROM log WHERE kind='mutation' AND seq > ? ORDER BY seq DESC")
      .all(startSeq) as { data_json: string | null }[];

    let stateReverted = 0;
    for (const row of mutationRows) {
      if (!row.data_json) continue;
      let parsed: MutationData;
      try {
        parsed = JSON.parse(row.data_json) as MutationData;
      } catch {
        continue; // 损坏的 data_json 不阻断回滚；进不了 residue 但 log 仍会被删净
      }
      const entity = parsed.entity;
      for (const a of parsed.applied ?? []) {
        if (a.old === null || a.old === undefined) {
          db.prepare("DELETE FROM state WHERE entity=? AND attr=?").run(entity, a.attr);
        } else {
          db.prepare(
            "INSERT INTO state (entity, attr, value) VALUES (?, ?, ?) " +
              "ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value",
          ).run(entity, a.attr, a.old);
        }
        stateReverted += 1;
      }
    }

    // 2) 探测本回合内被改动、但本原语无可逆信号的副作用表，记入 residue（冒泡，不静默）。
    //    判据：表自带 seq/created_seq 锚点的，按 > startSeq 计数；否则只能保守提示「可能含回合内态」。
    const residue: string[] = [];
    // pending_roll：event_id AUTOINCREMENT 即 seq 序，回合内新挂起的明骰 > startSeq 的对应起点。
    // 无精确 seq 锚点（event_id 与 log.seq 不同序），保守：若回合内 log 段非空且存在 awaiting 行则提示。
    const pendingAwaiting = (
      db.prepare("SELECT COUNT(*) c FROM pending_roll WHERE status='awaiting'").get() as { c: number }
    ).c;
    if (pendingAwaiting > 0 && mutationRows.length >= 0) {
      // 仅当本回合确实删了 log 段时才可能是回合内产物；用删除前的 log 段是否非空判定。
      const turnLogCount = (
        db.prepare("SELECT COUNT(*) c FROM log WHERE seq > ?").get(startSeq) as { c: number }
      ).c;
      if (turnLogCount > 0) {
        residue.push(
          `pending_roll: ${pendingAwaiting} 行挂起明骰（status=awaiting）未回滚——本原语不逆明骰挂起态，需 v2 快照或人工核对`,
        );
      }
    }
    // watcher 运行时态（armed/last_fired_seq/status）回合内可能被 recomputeWatchers 改写，
    // 但无 per-change 逆信号 —— 若回合内有 watcher_fired 事件即提示其 last_fired/status 漂移未逆。
    const watcherFired = (
      db.prepare("SELECT COUNT(*) c FROM log WHERE kind='watcher_fired' AND seq > ?").get(startSeq) as { c: number }
    ).c;
    if (watcherFired > 0) {
      residue.push(
        `watcher: 本回合有 ${watcherFired} 次 watcher_fired，watcher 运行时态（armed/last_fired_seq/status）未逆——需 v2 快照兜底`,
      );
    }

    // 3) 删本回合 log 段（最后做：state 逆放与 residue 探测都依赖它还在）。
    const turnLog = db.prepare("DELETE FROM log WHERE seq > ?").run(startSeq);
    const deletedLogCount = turnLog.changes;

    return { deletedLogCount, stateReverted, residue };
  });
  return tx();
}

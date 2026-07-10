// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 会话分支模型（裁决 debrief-and-branch §二）。
//
// 一个 dicegm session 下可有多个 branch，每 branch 一份独立事件日志/领域态/快照 ——
// 物理上 = 一个独立的 session db（"copy 一个新的 jsonl" 的落地）。
//   · 默认分支 main：db 键 = sessionId（沿用既有 session.db，向后兼容）。
//   · 其他分支：db 键 = `${sessionId}/branches/${branchId}`（嵌在 session 目录内，
//     不污染 sessions/dice 顶层的会话列表）。
// 分支登记（当前分支 + 分支清单）单源存 main 分支 db 的 session_meta，
// 因为 main db 恒在、且是切换分支时唯一可靠的锚点。
//
// 与 rewind 的区别：rewind 覆盖当前分支（截断其后事件）；branch 保留当前分支、另起一支。

import { randomUUID } from "node:crypto";
import type { DB } from "../store/db.js";
import { metaGet, metaSet } from "./resolve.js";
import { restore, listSnapshots } from "../store/snapshot.js";
import { ftsIndex, FTS_TABLES } from "../store/fts.js";

export const MAIN_BRANCH = "main";

// 分支 db 键：main 沿用 sessionId（无后缀，向后兼容既有 session.db）；其他嵌在 session 目录内。
export function branchDbKey(sessionId: string, branchId: string): string {
  return branchId === MAIN_BRANCH ? sessionId : `${sessionId}/branches/${branchId}`;
}

// 打开某分支 db 的注入器（组合根给：sid,bid → openSession(branchDbKey(sid,bid))）。
export type OpenBranchDb = (sessionId: string, branchId: string) => DB;

interface BranchMeta {
  branchId: string;
  name: string;
  createdAt: string;
  fromSeq: number;
  parentBranchId?: string;
}

export interface BranchInfo {
  branchId: string;
  name: string;
  createdAt: string;
  seq: number;
  isCurrent: boolean;
}
export interface BranchListResult {
  currentBranchId: string;
  branches: BranchInfo[];
}
export interface CreateBranchResult {
  branchId: string;
  sessionId: string;
  fromSeq: number;
  isCurrent: true;
}

const REGISTRY_KEY = "branch_registry";
const CURRENT_KEY = "current_branch";

export function currentBranch(mainDb: DB): string {
  return metaGet(mainDb, CURRENT_KEY) ?? MAIN_BRANCH;
}

// 读分支登记；首访时惰性播种 main（createdAt 复用 session created_at，无则 now）。
function readRegistry(mainDb: DB): BranchMeta[] {
  const raw = metaGet(mainDb, REGISTRY_KEY);
  if (raw) {
    try {
      const list = JSON.parse(raw) as BranchMeta[];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch { /* 破损 → 重新播种 */ }
  }
  const createdAt = metaGet(mainDb, "created_at") ?? new Date().toISOString();
  const seeded: BranchMeta[] = [{ branchId: MAIN_BRANCH, name: MAIN_BRANCH, createdAt, fromSeq: 0 }];
  writeRegistry(mainDb, seeded);
  return seeded;
}

function writeRegistry(mainDb: DB, list: BranchMeta[]): void {
  metaSet(mainDb, REGISTRY_KEY, JSON.stringify(list));
}

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM log").get() as { s: number | null };
  return r.s ?? 0;
}

// ── 分支查询 / 切换 / 新建 ──────────────────────────────────────────────

export function listBranches(mainDb: DB, openBranch: OpenBranchDb, sessionId: string): BranchListResult {
  const reg = readRegistry(mainDb);
  const cur = currentBranch(mainDb);
  const branches: BranchInfo[] = reg.map((b) => {
    let seq = 0;
    try { seq = maxSeq(openBranch(sessionId, b.branchId)); } catch { seq = 0; }
    return { branchId: b.branchId, name: b.name, createdAt: b.createdAt, seq, isCurrent: b.branchId === cur };
  });
  return { currentBranchId: cur, branches };
}

// 切换当前分支：校验分支存在后置位。返回 false = 未知分支（API 映射 404）。
export function checkoutBranch(mainDb: DB, branchId: string): boolean {
  const reg = readRegistry(mainDb);
  if (!reg.some((b) => b.branchId === branchId)) return false;
  metaSet(mainDb, CURRENT_KEY, branchId);
  return true;
}

// 新建分支 = 复制当前分支 db（截断到 fromSeq）→ 新分支自动成当前分支（C7）。
export function createBranch(
  mainDb: DB,
  openBranch: OpenBranchDb,
  sessionId: string,
  opts: { fromSeq?: number; name?: string } = {},
): CreateBranchResult {
  const reg = readRegistry(mainDb);
  const cur = currentBranch(mainDb);
  const curDb = openBranch(sessionId, cur);
  const curMax = maxSeq(curDb);
  const from = opts.fromSeq ?? curMax;

  const branchId = randomUUID();
  const destDb = openBranch(sessionId, branchId);
  cloneInto(curDb, destDb);
  // 新分支自有登记 — 抹掉从源 db 带过来的分支登记键，避免被误当 main 锚点。
  destDb.prepare("DELETE FROM session_meta WHERE key IN (?, ?)").run(REGISTRY_KEY, CURRENT_KEY);
  if (from < curMax) truncateToSeq(destDb, from);

  reg.push({
    branchId,
    name: opts.name && opts.name.trim() ? opts.name.trim() : branchId,
    createdAt: new Date().toISOString(),
    fromSeq: from,
    parentBranchId: cur,
  });
  writeRegistry(mainDb, reg);
  metaSet(mainDb, CURRENT_KEY, branchId);
  return { branchId, sessionId, fromSeq: from, isCurrent: true };
}

// ── db 复制 / 截断原语 ──────────────────────────────────────────────────

// 整库复制：逐基表全行 dump→重灌（保 rowid，故 log.seq / snapshot.id 等主键号稳定），
// 再据 FTS 表已存的 raw 原文重建全文索引（避开逐源表 index 口径的耦合）。
// 跳过 FTS 虚表/影子表（%_fts%）与 sqlite 内部表；视图不在 sqlite_master(type='table') 内。
export function cloneInto(src: DB, dest: DB): void {
  const tables = src
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE 'CREATE TABLE%' " +
        "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%\\_fts%' ESCAPE '\\'",
    )
    .all() as { name: string }[];
  const tx = dest.transaction(() => {
    for (const { name } of tables) copyTable(src, dest, name);
  });
  tx();
  // FTS 重建：源 FTS 表存有 raw 原文，重 tokenize 灌进 dest 的空虚表。
  for (const t of FTS_TABLES) {
    let rows: { rowid: number; raw: string | null }[] = [];
    try { rows = src.prepare(`SELECT rowid, raw FROM ${t}`).all() as typeof rows; } catch { continue; }
    for (const r of rows) if (r.raw != null) ftsIndex(dest, t, r.rowid, r.raw);
  }
}

function copyTable(src: DB, dest: DB, table: string): void {
  const rows = src.prepare(`SELECT rowid AS __rowid, * FROM ${table}`).all() as Record<string, unknown>[];
  dest.prepare(`DELETE FROM ${table}`).run();
  for (const r of rows) {
    const cols = Object.keys(r).filter((k) => k !== "__rowid");
    const withRowid = r.__rowid != null;
    const names = withRowid ? ["rowid", ...cols] : cols;
    const vals = withRowid ? [r.__rowid, ...cols.map((c) => r[c])] : cols.map((c) => r[c]);
    const ph = names.map(() => "?").join(", ");
    dest.prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${ph})`).run(...(vals as never[]));
  }
}

// 截断到 toSeq（rewind 覆盖当前分支 / branch 复制到 fromSeq 共用）：
//   ① 领域态复位到最近 turn_end_seq ≤ toSeq 的快照（无则不动，coarse）；
//   ② log / log_fts / snapshot 丢弃 toSeq 之后；③ 清 pending；④ 清 ended（复盘→续玩）。
export function truncateToSeq(db: DB, toSeq: number): void {
  const snaps = listSnapshots(db); // id 升序
  const best = [...snaps].reverse().find((s) => (s.turnEndSeq ?? 0) <= toSeq);
  const tx = db.transaction(() => {
    if (best) restore(db, best.id);
    db.prepare("DELETE FROM log WHERE seq > ?").run(toSeq);
    try { db.prepare("DELETE FROM log_fts WHERE rowid > ?").run(toSeq); } catch { /* 无 fts 虚表：跳过 */ }
    db.prepare("DELETE FROM snapshot WHERE turn_end_seq > ?").run(toSeq);
    db.prepare("DELETE FROM pending_choice").run();
    db.prepare("DELETE FROM pending_roll").run();
    db.prepare("DELETE FROM session_meta WHERE key='ended'").run();
    // 复位 log 的 AUTOINCREMENT 高水位到 toSeq，使续玩事件从 toSeq+1 连续编号（否则复制来的高水位造成 seq 跳空）。
    try { db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='log'").run(toSeq); } catch { /* 无 sqlite_sequence 行：跳过 */ }
  });
  tx();
}

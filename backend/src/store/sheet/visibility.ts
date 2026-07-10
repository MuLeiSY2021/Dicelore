// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../db.js";
import { stateGet, stateSet } from "./state.js";
import { logAppend } from "../event/record.js";
import { DiceloreError } from "@dicelore/errors";

// 可见性变更审计:kind=note、visible=0(对玩家隐),供 L3 / 回看(§4.2)。返回 audit event seq。
function auditNote(db: DB, content: string): number {
  return logAppend(db, { kind: "note", content, visible: 0 });
}

// attr 级:指定 cell 置 1(暗值 visible=2 焊死,不揭);entity 级(省 attr):写长效策略 cell __show_all。
// 返回 audit event seq(供调用方透出 audit_event_id)。
export function sheetShow(db: DB, entity: string, attr?: string): number {
  if (attr === undefined) {
    stateSet(db, entity, "__show_all", "1");
    return auditNote(db, `揭示:${entity} 全卡(__show_all)`);
  }
  db.prepare("UPDATE state SET visible=1 WHERE entity=? AND attr=? AND visible!=2").run(entity, attr);
  return auditNote(db, `揭示:${entity}.${attr}`);
}

export function worldShow(db: DB, table: "lore" | "pool", rowid: number): number {
  // table 是字面量联合类型(非用户自由输入)→ 插值安全。
  db.prepare(`UPDATE ${table} SET visible=1 WHERE rowid=?`).run(rowid);
  return auditNote(db, `揭示:${table}#${rowid}`);
}

// ===== 叙事三表可见性(A′ §1；show/reveal_once 扩到 front/plotline/foreshadow) =====
// 叙事表是行级对象,show 粒度=整行【C1】。table 为字面量联合(非用户自由输入)→ 插值安全。
// 各表「人读内容列」:front=name / plotline=title / foreshadow=content(reveal 冻结此列)。
export type NarrativeTable = "front" | "plotline" | "foreshadow";
const NARRATIVE_CONTENT_COL: Record<NarrativeTable, string> = {
  front: "name",
  plotline: "title",
  foreshadow: "content",
};

// 整行置 visible=1(暗值 visible=2 焊死,不揭);行不存在抛 ENTITY_NOT_FOUND。返回 audit event seq。
export function narrativeShow(db: DB, table: NarrativeTable, id: string): number {
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id);
  if (!exists) throw new DiceloreError("ENTITY_NOT_FOUND", `narrativeShow: ${table} 行不存在 ${id}`);
  db.prepare(`UPDATE ${table} SET visible=1 WHERE id=? AND visible!=2`).run(id);
  return auditNote(db, `揭示:${table}#${id}`);
}

// reveal_once:append 一条 kind=reveal 的可见 event,内容=该叙事行此刻冻结副本;不碰目标自身 visible(底层仍隐)。
export function narrativeRevealOnce(db: DB, table: NarrativeTable, id: string): number {
  const col = NARRATIVE_CONTENT_COL[table];
  const row = db.prepare(`SELECT ${col} AS content FROM ${table} WHERE id=?`).get(id) as { content: string } | undefined;
  if (!row) throw new DiceloreError("ENTITY_NOT_FOUND", `narrativeRevealOnce: ${table} 行不存在 ${id}`);
  return logAppend(db, {
    kind: "reveal",
    visible: 1,
    content: row.content,
    data_json: { kind: table, id, content: row.content },
  });
}

// RevealTarget 定义下沉 @dicelore/interface(SessionBackend 方法面引用)；re-export 保持公共面。
import type { RevealTarget } from "@dicelore/interface";
export type { RevealTarget };

// reveal_once:append 一条 kind=reveal 的可见 event,内容=目标此刻冻结副本;不碰目标自身 visible(底层仍隐)。
export function revealOnce(db: DB, target: RevealTarget): number {
  if (target.kind === "sheet") {
    const cell = stateGet(db, target.entity, target.attr);
    if (!cell) throw new DiceloreError("ENTITY_NOT_FOUND", `revealOnce: sheet cell 不存在 ${target.entity}.${target.attr}`);
    return logAppend(db, {
      kind: "reveal",
      visible: 1,
      content: `${target.entity}.${target.attr} = ${cell.value}`,
      data_json: { kind: "sheet", entity: target.entity, attr: target.attr, value: cell.value },
    });
  }
  const doc = db.prepare("SELECT name, content FROM lore WHERE rowid=?").get(target.rowid) as
    | { name: string; content: string }
    | undefined;
  if (!doc) throw new DiceloreError("ENTITY_NOT_FOUND", `revealOnce: lore#${target.rowid} 不存在`);
  return logAppend(db, {
    kind: "reveal",
    visible: 1,
    content: doc.content,
    data_json: { kind: "lore", rowid: target.rowid, name: doc.name, content: doc.content },
  });
}

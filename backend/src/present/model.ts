// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";

export interface EchoEntry { seq: number; kind: "verdict" | "mutation" | "watcher_fired"; text: string }
export interface VisibleCell { entity: string; attr: string; value: string }
export interface ChoiceView { prompt: string; options: { label: string; consequence: string }[]; seq: number }
export interface PresentationModel {
  mechanicalEcho: EchoEntry[];
  statusMenu: VisibleCell[];
  pendingChoice?: ChoiceView;
}

const ECHO_KINDS = ["verdict", "mutation", "watcher_fired"] as const;

// 可见性判定(玩家视角):cell 可见 ⟺ visible=1 ∨ (entity 有 __show_all=1 ∧ visible≠2);
// __show_all 标记 cell 本身不进菜单。
function statusMenu(db: DB): VisibleCell[] {
  return db.prepare(
    `SELECT entity, attr, value FROM state
      WHERE attr != '__show_all'
        AND ( visible = 1
              OR ( visible != 2
                   AND entity IN (SELECT entity FROM state WHERE attr='__show_all' AND value='1') ) )
      ORDER BY entity, attr`,
  ).all() as VisibleCell[];
}

function mechanicalEcho(db: DB, turnStartSeq: number): EchoEntry[] {
  const rows = db.prepare(
    `SELECT seq, kind, content, data_json FROM log
      WHERE seq > ? AND kind IN ('verdict','mutation','watcher_fired') AND visible = 1
      ORDER BY seq`,
  ).all(turnStartSeq) as { seq: number; kind: EchoEntry["kind"]; content: string | null; data_json: string | null }[];
  return rows.map((r) => ({ seq: r.seq, kind: r.kind, text: echoText(r.content, r.data_json) }));
}

// v1:优先 event.content(裁决/mutation 工具已写人类可读串);缺则紧凑回退。富格式化留后续。
function echoText(content: string | null, dataJson: string | null): string {
  if (content && content.trim()) return content;
  return dataJson ?? "";
}

// 待选项投影：取最新 kind=choice event 作待选项，但若它已被玩家选择消费则不再投影。
// 玩家点选(DiceSession.handleChoice)会落一条 kind=note 隐事件、data_json.player_choice.eventId=该 choice 的 seq；
// 据此过滤掉「已解决」的 choice——否则直到 GM 物化新 choice 前，已答过的选项会被持续投影成可操作待选(状态错位)。
function pendingChoice(db: DB): ChoiceView | undefined {
  const row = db.prepare(
    "SELECT seq, data_json FROM log WHERE kind='choice' ORDER BY seq DESC LIMIT 1",
  ).get() as { seq: number; data_json: string | null } | undefined;
  if (!row || !row.data_json) return undefined;
  // 已被后续玩家选择消费？(player_choice note 指回本 choice 的 seq) → 不投影。
  const consumed = db.prepare(
    "SELECT 1 FROM log WHERE kind='note' AND seq > ? AND json_extract(data_json, '$.player_choice.eventId') = ? LIMIT 1",
  ).get(row.seq, row.seq) as unknown;
  if (consumed) return undefined;
  const d = JSON.parse(row.data_json) as { prompt: string; options: { label: string; consequence: string }[] };
  return { prompt: d.prompt, options: d.options, seq: row.seq };
}

export function buildPresentationModel(db: DB, opts: { turnStartSeq?: number } = {}): PresentationModel {
  const turnStartSeq = opts.turnStartSeq ?? lastTurnStart(db);
  return {
    mechanicalEcho: mechanicalEcho(db, turnStartSeq),
    statusMenu: statusMenu(db),
    pendingChoice: pendingChoice(db),
  };
}

// 未给 turnStartSeq:回退到「最近一条机械类 event 之前」近似本轮起点;无则 0(全量)。
function lastTurnStart(db: DB): number {
  const row = db.prepare(
    "SELECT MIN(seq) s FROM log WHERE kind IN ('verdict','mutation','watcher_fired')",
  ).get() as { s: number | null };
  return row.s === null ? 0 : row.s - 1;
}

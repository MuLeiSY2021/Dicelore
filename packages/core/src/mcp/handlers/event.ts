// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../../store/db.js";
import { logAppend, logRecall, type LogRow } from "../../store/log.js";
import { watcherSet, watcherList, type WatcherRow } from "../../store/watcher.js";
import { truncateText } from "../../store/truncate.js";
import type { ToolDef } from "../tooldef.js";
import {
  eventAppendIn,
  eventAppendOut,
  eventRecallIn,
  eventRecallOut,
  watcherSetIn,
  watcherSetOut,
  watcherListIn,
  watcherListOut,
} from "../schemas/event.js";

function appendHandler(
  db: DB,
  input: { content?: string; kind: any; data_json?: unknown; tags?: string[]; visible?: 0 | 1 },
) {
  const event_id = logAppend(db, {
    content: input.content,
    kind: input.kind,
    data_json: input.data_json,
    tags: input.tags?.length ? input.tags.join(" ") : undefined,
    visible: input.visible,
  });
  return { event_id };
}

function recallHandler(db: DB, input: { query: string; k: number }) {
  const rows = logRecall(db, input.query, { limit: input.k });
  const events = rows.map((e: LogRow) => ({
    seq: e.seq,
    kind: e.kind,
    content: e.content,
    visible: e.visible,
  }));
  const { truncated } = truncateText(JSON.stringify(events));
  return { events, truncated };
}

function watcherHandler(
  db: DB,
  input: { condition: string; payload: string; mode: "once" | "repeat" },
) {
  const watcher_id = watcherSet(db, {
    condition: input.condition,
    payload: input.payload,
    mode: input.mode,
  });
  return { watcher_id };
}

function watcherListHandler(db: DB) {
  const watchers = watcherList(db).map((w: WatcherRow) => ({
    id: w.id,
    condition: w.condition,
    payload: w.payload,
    mode: w.mode,
    armed: w.armed,
    status: w.status,
  }));
  return { watchers };
}

export const eventTools: ToolDef[] = [
  {
    name: "event_append",
    title: "追加事件",
    description:
      "向事件流追加一条记录(散文进 content 走 FTS)。Args: content?、kind(narrate/note/verdict/mutation/watcher_fired/reveal,默认 note)、data_json?、tags?(数组)、visible?(0|1,省略按 kind 默认)。" +
      "Returns: {event_id}。use: 记录非裁决的事实/旁注。don't: 当叙述通道(用 narrate)。错误: 入参非法→INTERNAL。",
    inputSchema: eventAppendIn,
    outputSchema: eventAppendOut,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: appendHandler,
  },
  {
    name: "event_recall",
    title: "召回历史事件",
    description:
      "FTS5(jieba)召回历史事件。Args: query、k(1-100,默认8)。Returns: {events:[{seq,kind,content,visible}], truncated}。" +
      "use: 找回早前剧情/伏笔。don't: 取角色属性(用 sheet_*)。错误: 入参非法→INTERNAL。",
    inputSchema: eventRecallIn,
    outputSchema: eventRecallOut,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: recallHandler,
  },
  {
    name: "watcher_set",
    title: "登记条件触发器",
    description:
      '登记谓词触发器,sheet_update 写完就地比对(非轮询),edge-triggered。Args: condition(谓词 expr 如 "{张三.HP} < 30")、payload(触发时给 AI 的提示)、mode(once/repeat,默认 once)。' +
      "Returns: {watcher_id}。use: 埋「HP 跌破阈值」类反应。don't: 立刻判定(那直接读 sheet)。错误: condition 文法非法→EXPR_EVAL(触发时)。",
    inputSchema: watcherSetIn,
    outputSchema: watcherSetOut,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: watcherHandler,
  },
  {
    name: "watcher_list",
    title: "列出未触发的触发器",
    description:
      "列出当前所有 active(armed)watcher,供 GM 回顾自己埋下、尚未触发的钟/Front/伏笔反应。Args: 无。" +
      "Returns: {watchers:[{id,condition,payload,mode,armed,status}]}。use: 长程局盘点未结张力(哪些条件还没满足)。don't: 改触发器(用 watcher_set)。错误: 入参非法(传了多余键)→BAD_INPUT。",
    inputSchema: watcherListIn,
    outputSchema: watcherListOut,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: watcherListHandler,
  },
];

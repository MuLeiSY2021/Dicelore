// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/sheet.ts
import type { DB } from "../../store/db.js";
import { stateGet, stateList } from "../../store/state.js";
import { applyMutations } from "../../store/mutate.js";
import { truncateText } from "../../store/truncate.js";
import type { ToolDef } from "../tooldef.js";
import {
  sheetGetIn,
  sheetGetOut,
  sheetListIn,
  sheetListOut,
  sheetUpdateIn,
  sheetUpdateOut,
} from "../schemas/sheet.js";

function getHandler(db: DB, input: { entity: string; attr: string }) {
  const cell = stateGet(db, input.entity, input.attr);
  return cell ? { value: cell.value, visible: cell.visible } : { value: null, visible: 0 };
}

function listHandler(db: DB, input: { entity: string; prefix?: string; limit: number; offset: number }) {
  const all = stateList(db, `${input.entity}.${input.prefix ?? ""}`);
  const page = all.slice(input.offset, input.offset + input.limit);
  const has_more = input.offset + input.limit < all.length;
  const cells = page.map((c) => ({ attr: c.attr, value: c.value, visible: c.visible }));
  const { truncated } = truncateText(JSON.stringify(cells));
  const out: any = { cells, has_more, truncated };
  if (has_more) out.next_offset = input.offset + input.limit;
  return out;
}

function updateHandler(db: DB, input: { entity: string; mutations: any[] }) {
  const r = applyMutations(db, input.entity, input.mutations); // mutation event 自落,透传 event_id
  return {
    entity: r.entity,
    applied: r.applied,
    fired_watchers: r.fired_watchers,
    event_id: r.event_id,
  };
}

export const sheetTools: ToolDef[] = [
  {
    name: "sheet_get",
    title: "读单格",
    description:
      "读 entity.attr 单格(GM 全见,含 visible)。Args: entity、attr。Returns: {value:string|null, visible}。" +
      "use: 取单个属性真值。don't: 批量取整卡(用 sheet_list)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetGetIn,
    outputSchema: sheetGetOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: getHandler,
  },
  {
    name: "sheet_list",
    title: "前缀扫描卡表",
    description:
      "按前缀扫 entity 的格(分页)。Args: entity、prefix(可选,如 \"库存:\")、limit(1-200,默认100)、offset(默认0)。" +
      "Returns: {cells:[{attr,value,visible}], has_more, next_offset?, truncated}。use: 取整卡/整库存。don't: 取单格(用 sheet_get)。错误: 入参非法→INTERNAL。",
    inputSchema: sheetListIn,
    outputSchema: sheetListOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: listHandler,
  },
  {
    name: "sheet_update",
    title: "批量改卡(状态骰下沉)",
    description:
      "一次 entity 作用域批量写,整批一个事务。Args: entity、mutations(≥1 项,各 {attr, op:+|-|=, expr})。expr 随 op 多态(值表达式/词条字面量);带骰项引擎内掷,AI 给不出真值。" +
      "Returns: {entity, applied:[{attr,op,kind,old,rolls?,delta?,new}], fired_watchers?, event_id}。use: 扣血/加物品/赋值。don't: 在 expr 里硬编随机结果。错误: 非数值算术→NOT_NUMERIC(整批回滚);expr 非法→EXPR_EVAL。",
    inputSchema: sheetUpdateIn,
    outputSchema: sheetUpdateOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: updateHandler,
  },
];

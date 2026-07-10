// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/handlers/sheet.ts
// ported ops(state 批改)经注入的 SessionBackend 端口调用，不再直连 @dicelore/backend 自由函数
// (storage-port ADR §4)。
//
// A′ §4（裁决 a-prime-completion.md）：裸 sheet_get/sheet_list 已删——类型化读替代品就位
// （player_card/npc_list/world_state，见 backend/src/stdlib/{player,npc,world}.ts，查对应 kind 视图）。
// 唯一保留的裸写 sheet_update 作「即兴兜底」：类型化写 attr 声明期固定，任意即兴 attr 仍走此工具
// （applyMutations 无 kind 标注 → 默认落 kind=world，裁决 C4）。可见性工具 sheet_show 在 handlers/io.ts、不受影响。
import type { SessionBackend } from "@dicelore/interface";
import type { ToolDef } from "../tooldef.js";
import { sheetUpdateIn, sheetUpdateOut } from "../schemas/sheet.js";

/** 内置 sheet 写工具（handler 闭包持注入的 SessionBackend；忽略 runTool 传入的 db）。 */
export function makeSheetTools(backend: SessionBackend): ToolDef[] {
  function updateHandler(_: unknown, input: { entity: string; mutations: any[] }) {
    const r = backend.applyMutations(input.entity, input.mutations); // 无 kind → 默认 kind=world；mutation event 自落,透传 event_id
    return {
      entity: r.entity,
      applied: r.applied,
      fired_watchers: r.fired_watchers,
      event_id: r.event_id,
    };
  }

  return [
  {
    name: "sheet_update",
    title: "批量改卡(即兴兜底·状态骰下沉)",
    description:
      "一次 entity 作用域批量写(即兴任意 attr 兜底,落 kind=world),整批一个事务。Args: entity、mutations(≥1 项,各 {attr, op:+|-|=, expr})。expr 随 op 多态(值表达式/词条字面量);带骰项引擎内掷,AI 给不出真值。" +
      "Returns: {entity, applied:[{attr,op,kind,old,rolls?,delta?,new}], fired_watchers?, event_id}。use: 扣血/加物品/赋值/即兴世界态。don't: 写玩家/NPC 语义属性(用 player_update_*/npc_update_*)。错误: 非数值算术→NOT_NUMERIC(整批回滚);expr 非法→EXPR_EVAL。",
    inputSchema: sheetUpdateIn,
    outputSchema: sheetUpdateOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: updateHandler,
  },
  ];
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { ToolDecl } from "../toolgen/compile.js";
import { toolgenToToolDef } from "../toolgen/toToolDef.js";
import type { ToolDef } from "@dicelore/interface";

// 世界态类型化读（A′ §4，替裸 sheet_*）：kind 由工具名携带、查 `world` 视图
// （store/views.ts `WHERE kind='world'`），投影带 `'world' AS kind` 常量列。
//
// 写侧「world_update」：按裁决 C4，即兴世界态写由**保留的裸 `sheet_update`** 承担
// （applyMutations 默认落 kind=world），不另立类型化世界写工具——避免与 sheet_update 冗余。
export const worldToolDecls: ToolDecl[] = [
  {
    name: "world_state",
    desc:
      "列出世界态（kind=world 全投影：地点/时间/势力等世界层可变状态）。无参。Returns: 行数组 {entity, attr, value, visible, kind}（kind 恒 'world'）。" +
      "use: 查当前世界态/环境变量。don't: 读玩家卡(用 player_card)/读 NPC(用 npc_list)/检索世界散文设定(用 world_search)。错误: 入参非法→BAD_INPUT。",
    sql: "SELECT entity, attr, value, visible, 'world' AS kind FROM world ORDER BY entity, attr",
  },
];

/** 编译世界态标准库声明为运行时 ToolDef[]，供 createMcpServer 经 extraTools 注入。 */
export function worldStdlibTools(): ToolDef[] {
  return worldToolDecls.map(toolgenToToolDef);
}

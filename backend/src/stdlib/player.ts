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

// 玩家卡类型化读写（A′ §4，替裸 sheet_*）：与 npc 一等抽象同一套声明式范式
// （ToolDecl → toolgenToToolDef → extraTools 注入），**零硬编码 handler**（守 DT-9）。
//   - 读侧 player_card：查 `player` 视图（store/views.ts `WHERE kind='player'`），投影带
//     `'player' AS kind` 常量列，回给 GM 的每行显式携带 kind=player。
//   - 写侧 player_update_*：mutate 模式 + `kind:"player"` 标注——编译时透传给正典写原语
//     applyMutations，写出的 state 行落 kind=player，player 视图方可读到（“kind 由工具名携带”）。
//
// 约束同 npc.ts：`:param` 名须 ASCII；mutate 模式 attr 声明期固定——故 player 写按「常用语义动词」
// 拆成定 attr 工具（HP），而非吃任意 attr 的泛写（泛写破 DT-9）；任意即兴 attr 仍可用裸 sheet_update
// 兜底（写 kind=world）。
export const playerToolDecls: ToolDecl[] = [
  {
    name: "player_card",
    desc:
      "读玩家角色卡（kind=player 全投影）。Args: entity(玩家实体名)。Returns: 行数组 {entity, attr, value, visible, kind}（kind 恒 'player'）。" +
      "use: 开局/回合内查玩家属性。don't: 读 NPC(用 npc_list)/读世界态(用 world_state)。错误: 入参非法→BAD_INPUT。",
    params: { entity: "string" },
    sql: "SELECT entity, attr, value, visible, 'player' AS kind FROM player WHERE entity = :entity ORDER BY attr",
  },
  {
    name: "player_update_hp",
    desc:
      "改玩家 HP（±delta，战斗/伤害/治疗）。Args: entity(玩家实体名)、delta(整数,正加负减)。落 kind=player，经 applyMutations 触发 watcher。" +
      "use: 玩家受伤/回血。don't: 在 delta 里硬编随机结果(带骰用 sheet_update expr)。错误: 非数值算术→NOT_NUMERIC。",
    params: { entity: "string", delta: "int" },
    sql: "UPDATE state SET HP = HP + :delta WHERE entity = :entity",
    kind: "player",
  },
];

/** 编译玩家标准库声明为运行时 ToolDef[]，供 createMcpServer 经 extraTools 注入。 */
export function playerStdlibTools(): ToolDef[] {
  return playerToolDecls.map(toolgenToToolDef);
}

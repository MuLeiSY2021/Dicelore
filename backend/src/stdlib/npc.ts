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

// NPC 一等抽象（A1，spec 2026-06-26-npc一等抽象-design）：把 state 的 `npc` kind 升为
// 运行时一等概念。读侧＝已投影的 `npc` 视图（store/views.ts `WHERE kind='npc'`）；
// 写侧＝本声明的类型化写工具——全走与叙事八工具同一套声明式范式（ToolDecl →
// toolgenToToolDef → extraTools 注入），**零硬编码 handler**（守 DT-9）。
//
// 关键：每条均 mutate 模式 + `kind:"npc"` 标注——编译时透传给正典写原语 applyMutations，
// 使写出的 state 行落 kind=npc，npc 视图方可读到（“kind 由工具名携带”，spec §4.1 方案 B）。
//
// 约束（toolgen 引擎现状，非本线引入）：
//   - `:param` 名须 ASCII（writeMatch `:(\w+)` 无 u 标志）；attr 名可中文。
//   - mutate 模式的 attr 在声明期固定——故 npc 写按「常用语义动词」拆成定 attr 工具
//     （好感 / HP / 身份 / 简介），而非一个吃任意 attr 的泛写（泛写需结构化 mutations[]
//     入参＝硬编码 handler，破 DT-9，故不走；任意即兴 attr 仍可用裸 sheet_update 兜底）。
export const npcToolDecls: ToolDecl[] = [
  {
    // 类型化读（A′ §4）：kind 由工具名携带、查 npc 视图（store/views.ts `WHERE kind='npc'`）。
    // 投影带 `'npc' AS kind` 常量列——回给 GM 的每行显式携带 kind=npc（自证归属，替代已删的裸 sheet_list）。
    name: "npc_list",
    desc:
      "列出全部 NPC 的卡格（kind=npc 全投影）。无参。Returns: 行数组 {entity, attr, value, visible, kind}（kind 恒 'npc'）。" +
      "use: 盘点在场 NPC / 查某 NPC 属性。don't: 读玩家卡(用 player_card)/读世界态(用 world_state)。错误: 入参非法→BAD_INPUT。",
    sql: "SELECT entity, attr, value, visible, 'npc' AS kind FROM npc ORDER BY entity, attr",
  },
  {
    name: "npc_register",
    desc:
      "登记一个 NPC（写其简介，落 kind=npc 首行，使该实体进入 npc 视图）。Args: npc(实体名)、简介。" +
      "use: 新 NPC 首次出场先登记。don't: 改已登记 NPC 属性(用 npc_update_*)。",
    params: { npc: "string", bio: "string" },
    sql: "UPDATE state SET 简介 = :bio WHERE entity = :npc",
    kind: "npc",
  },
  {
    name: "npc_update_affinity",
    desc:
      "改某 NPC 对玩家的好感（±delta）。Args: npc(实体名)、delta(整数,正加负减)。落 kind=npc，经 applyMutations 触发 watcher。" +
      "use: 玩家言行影响 NPC 态度。don't: 在 delta 里硬编随机结果。",
    params: { npc: "string", delta: "int" },
    sql: "UPDATE state SET 好感 = 好感 + :delta WHERE entity = :npc",
    kind: "npc",
  },
  {
    name: "npc_update_hp",
    desc:
      "改某 NPC 的 HP（±delta，战斗/伤害）。Args: npc(实体名)、delta(整数)。落 kind=npc，经 applyMutations 触发 watcher。" +
      "use: NPC 受伤/治疗。don't: 写玩家 HP(用 player 侧工具)。",
    params: { npc: "string", delta: "int" },
    sql: "UPDATE state SET HP = HP + :delta WHERE entity = :npc",
    kind: "npc",
  },
  {
    name: "npc_set_identity",
    desc:
      "设某 NPC 的身份/标签（赋值，覆盖）。Args: npc(实体名)、身份(文本)。落 kind=npc。" +
      "use: 揭示/改写 NPC 角色定位(村长→叛徒)。don't: 当好感数值用(用 npc_update_affinity)。",
    params: { npc: "string", role: "string" },
    sql: "UPDATE state SET 身份 = :role WHERE entity = :npc",
    kind: "npc",
  },
];

/** 编译 NPC 标准库声明为运行时 ToolDef[]，供 createMcpServer 经 extraTools 注入。 */
export function npcStdlibTools(): ToolDef[] {
  return npcToolDecls.map(toolgenToToolDef);
}

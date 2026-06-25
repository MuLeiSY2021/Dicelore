// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { ToolDecl } from "../../toolgen/compile.js";
import { toolgenToToolDef } from "../../toolgen/toToolDef.js";
import type { ToolDef } from "../tooldef.js";

// 框架自带「第一个标准库包」（dogfooding，spec §8）：叙事层 front/plotline/foreshadow
// 业务工具不硬编码，用声明式工具生成层声明出来。只含 writeMatch 三模式可表达者；
// front_advance（推进 clock，需跨表 JOIN）撞 DSL 天花板，不在此（记 backlog）。
export const narrationToolDecls: ToolDecl[] = [
  {
    name: "front_open",
    desc: "开一个 Front（威胁势力：名+利害）。Args: id, name, stakes。落 front 表 status=active。",
    params: { id: "string", name: "string", stakes: "string" },
    sql: "INSERT INTO front (id, name, stakes) VALUES (:id, :name, :stakes)",
  },
  {
    name: "plotline_open",
    desc: "开一条情节线。Args: id, title, summary。落 plotline 表 status=open。",
    params: { id: "string", title: "string", summary: "string" },
    sql: "INSERT INTO plotline (id, title, summary) VALUES (:id, :title, :summary)",
  },
  {
    name: "plotline_advance",
    desc: "推进一条情节线状态（status 传 active）。Args: id, status。",
    params: { id: "string", status: "string" },
    sql: "UPDATE plotline SET status = :status WHERE id = :id",
  },
  {
    name: "plotline_close",
    desc: "收口一条情节线（status 传 closed）。Args: id, status。",
    params: { id: "string", status: "string" },
    sql: "UPDATE plotline SET status = :status WHERE id = :id",
  },
  {
    name: "foreshadow_plant",
    desc: "埋一个伏笔。Args: id, content。落 foreshadow 表 status=planted。",
    params: { id: "string", content: "string" },
    sql: "INSERT INTO foreshadow (id, content) VALUES (:id, :content)",
  },
  {
    name: "foreshadow_recall",
    desc: "回收一个伏笔（status 传 recalled）。Args: id, status。",
    params: { id: "string", status: "string" },
    sql: "UPDATE foreshadow SET status = :status WHERE id = :id",
  },
  {
    name: "foreshadow_abandon",
    desc: "弃置一个伏笔（status 传 abandoned）。Args: id, status。",
    params: { id: "string", status: "string" },
    sql: "UPDATE foreshadow SET status = :status WHERE id = :id",
  },
  {
    name: "tension_board",
    desc: "列出所有未结张力（active front + open/active plotline + planted foreshadow + armed watcher）。无参，回 {kind,id,label,status} 行数组。",
    sql: "SELECT kind, id, label, status FROM tension_board ORDER BY kind, id",
  },
];

/** 编译标准库声明为运行时 ToolDef[]，供 createMcpServer 注入。 */
export function narrationStdlibTools(): ToolDef[] {
  return narrationToolDecls.map(toolgenToToolDef);
}

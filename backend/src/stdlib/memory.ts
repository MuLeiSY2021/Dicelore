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

// 记忆工具标准库（A′ §6，裁决 a-prime-completion）：mark_moment / history_compact / recall。
// 与叙事八工具 / npc 类型化工具同一套声明式范式（ToolDecl → toolgenToToolDef → extraTools 注入），
// 零硬编码 handler（守 DT-9）：
//   - mark_moment / history_compact = 写工具，SQL 形状经 writeMatch 映射到 markMoment / historyCompact
//     正典写原语（store/event/*），永不裸跑 SQL。
//   - recall = 纯读工具，SELECT 经 assertReadOnlySelect 校验；先 history 摘要、再 moment、末兜底普通
//     log，按 pri 排序（裁决「先查 history+moment、再兜底 log」）。子串 LIKE 检索（声明式 SELECT
//     无法在 SQL 层做 jieba 分词，故用确定性子串匹配；jieba FTS 召回是正交能力，见 logRecall）。
export const memoryToolDecls: ToolDecl[] = [
  {
    name: "mark_moment",
    desc:
      "标记某条 log 为「关键时刻」(is_moment=1)。Args: seq(log 序号)。" +
      "use: 剧情收束/重大抉择/伏笔回收等值得长期记住的节点。don't: 给闲聊流水乱标(压缩/召回会优先保留 moment)。",
    params: { seq: "int" },
    sql: "UPDATE log SET is_moment = 1 WHERE seq = :seq",
  },
  {
    name: "history_compact",
    desc:
      "把一段 log [seq_from, seq_to] 压缩成一条 history 摘要(优先保留其中 moment)。" +
      "Args: seq_from、seq_to、summary(你读那段 log 后拟就的摘要)。use: 上文过长、需把旧回合折叠成梗概。" +
      "don't: 丢弃 moment 的关键信息。",
    params: { seq_from: "int", seq_to: "int", summary: "string" },
    sql: "INSERT INTO history (seq_from, seq_to, summary) VALUES (:seq_from, :seq_to, :summary)",
  },
  {
    name: "recall",
    desc:
      "检索历史记忆:先 history 摘要、再 moment、末兜底普通 log,含 query 子串者按优先级返回。" +
      "Args: query(检索词)。回 {src,seq,text} 行数组。use: 回收伏笔/找回旧约定/查某人某事。",
    params: { query: "string" },
    sql:
      "SELECT src, seq, text FROM (" +
      "SELECT 'history' AS src, seq_to AS seq, summary AS text, 0 AS pri FROM history WHERE summary LIKE '%' || :query || '%' " +
      "UNION ALL " +
      "SELECT 'moment' AS src, seq AS seq, content AS text, 1 AS pri FROM log WHERE is_moment = 1 AND content LIKE '%' || :query || '%' " +
      "UNION ALL " +
      "SELECT 'log' AS src, seq AS seq, content AS text, 2 AS pri FROM log WHERE is_moment = 0 AND content LIKE '%' || :query || '%'" +
      ") ORDER BY pri, seq",
  },
];

/** 编译记忆标准库声明为运行时 ToolDef[]，供 createMcpServer 经 extraTools 注入。 */
export function memoryStdlibTools(): ToolDef[] {
  return memoryToolDecls.map(toolgenToToolDef);
}

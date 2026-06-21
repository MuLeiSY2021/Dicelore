// src/mcp/handlers/world.ts
import type { DB } from "../../store/db.js";
import { worldDocSearch, worldSample, worldRegister, worldDocUpsert, type WorldDoc } from "../../store/world.js";
import { ruleSearch, type RuleDoc } from "../../store/rule.js";
import { truncateText } from "../../store/truncate.js";
import { DiceloreError } from "../../errors.js";
import type { ToolDef } from "../tooldef.js";
import {
  worldSearchIn, worldSearchOut, worldSampleIn, worldSampleOut,
  worldRegisterIn, worldRegisterOut, ruleSearchIn, ruleSearchOut,
} from "../schemas/world.js";

function searchHandler(db: DB, input: { query: string; k: number; category?: string }) {
  let docs = worldDocSearch(db, input.query, input.k);
  if (input.category) docs = docs.filter((d) => d.category === input.category);
  const mapped = docs.map((d: WorldDoc) => ({ name: d.name, content: d.content, category: d.category, visible: d.visible }));
  const { truncated } = truncateText(JSON.stringify(mapped));
  return { docs: mapped, truncated };
}

function sampleHandler(db: DB, input: { pool: string; n: number; filter?: Record<string, string | number> }) {
  const rows = worldSample(db, input.pool, input.n, { filter: input.filter });
  return { rows };
}

function registerHandler(
  db: DB,
  input: { target: "doc" | "pool"; doc?: any; pool?: any; visible: 0 | 1 },
) {
  // target↔payload 一致性校验(原 schema refine 下沉至此)
  if (input.target === "doc" ? !input.doc : !input.pool) {
    throw new DiceloreError("INTERNAL", "world_register: target 与 doc/pool 不匹配");
  }
  let rowid: number;
  if (input.target === "doc") {
    rowid = worldDocUpsert(db, { ...input.doc, visible: input.visible });
  } else {
    rowid = worldRegister(db, { pool: input.pool.pool, row: input.pool.row, weight: input.pool.weight, visible: input.visible });
  }
  return { ok: true as const, rowid };
}

function ruleHandler(db: DB, input: { query: string; k: number }) {
  const rules = ruleSearch(db, input.query, input.k).map((r: RuleDoc) => ({ name: r.name, content: r.content, version: r.version }));
  const { truncated } = truncateText(JSON.stringify(rules));
  return { rules, truncated };
}

export const worldTools: ToolDef[] = [
  {
    name: "world_search",
    title: "检索世界设定",
    description:
      "FTS5 检索世界散文设定。Args: query、k(1-100,默认20)、category?(命中后过滤)。Returns: {docs:[{name,content,category,visible}], truncated}。" +
      "use: 取地点/NPC/背景设定。don't: 取随机表(用 world_sample)。错误: 入参非法→INTERNAL。",
    inputSchema: worldSearchIn,
    outputSchema: worldSearchOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: searchHandler,
  },
  {
    name: "world_sample",
    title: "加权抽样随机表",
    description:
      "从 pool 加权无放回抽 n 行。Args: pool、n(默认1)、filter?(键值精确匹配 row_json 字段)。Returns: {rows:[...]}。" +
      "use: 抽遭遇/战利品/随机事件。don't: 取确定设定(用 world_search)。错误: 入参非法→INTERNAL。",
    inputSchema: worldSampleIn,
    outputSchema: worldSampleOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: sampleHandler,
  },
  {
    name: "world_register",
    title: "现编世界条目",
    description:
      "运行期 GM 现编世界条目(默认隐,待 show)。Args: target(doc|pool)、doc?{name,content,category?,tags?} 或 pool?{pool,row,weight?}、visible?(默认0)。" +
      "Returns: {ok:true, rowid}。use: 即兴扩世界。don't: 写规则(rule 只读)。错误: target 与 payload 不匹配→INTERNAL。",
    inputSchema: worldRegisterIn,
    outputSchema: worldRegisterOut,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    handler: registerHandler,
  },
  {
    name: "rule_search",
    title: "检索规则(只读)",
    description:
      "FTS5 检索作者灌注的规则(AI 只读,无写工具)。Args: query、k(1-100,默认20)。Returns: {rules:[{name,content,version}], truncated}。" +
      "use: 查机制裁定依据。don't: 改规则(不可)。错误: 入参非法→INTERNAL。",
    inputSchema: ruleSearchIn,
    outputSchema: ruleSearchOut,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: ruleHandler,
  },
];

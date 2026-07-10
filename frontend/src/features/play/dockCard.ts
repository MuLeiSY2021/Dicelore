// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// dock-card 模板引擎（裁决 dock-card-template）：
//   模板源码 = 数据选择器(dc-meta · YAML front matter 风格) + markdown 体(dc-body 含插值)。
//   数据源 = GET /presentation 的 sheets（entity→cell）。
// 本模块纯函数：解析模板 + 跑 select + 插值展开成最终 markdown 串。dial/bar 由渲染层拆分处理。
//
// 支持（v1）：单 select + where 过滤 + order/limit；插值 ${attr}；条件块 ${{expr}}...${{/if}}；
//   循环 ${#each <select>}...${{/each}}；可视化 ![dial](attr) / ![bar](attr)。
// DIY 边界（C3）：DIY 模板仅取 visible=1 的 cell（预设模板不受限）。

import type { SheetGroup } from "@dicelore/shared";

export interface TemplateMeta {
  select?: string;
  where?: { attr: string; op: string; value: string };
  order?: string;
  limit?: number;
}
export interface ParsedTemplate {
  meta: TemplateMeta;
  body: string; // markdown 体（含插值语法）
}

const WHERE_RE = /^\s*(\S+)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;

// 解析模板源码。支持两种 dc-meta 形态：
//   ① canonical YAML front matter：--- select: X\n where: a > b ---\n<body>
//   ② 宽松原型态：首个空行前的 `select ...` / `where ...` 行（原型 play.html 用此风格）。
export function parseTemplate(src: string): ParsedTemplate {
  const text = src.replace(/\r\n/g, "\n");
  const meta: TemplateMeta = {};
  let body = text;

  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      applyMetaLine(meta, line);
    }
  } else {
    // 宽松态：取到首个 markdown 标题(## / #)或空行块之前的 select/where/order/limit 行。
    const lines = text.split("\n");
    const rest: string[] = [];
    let inHead = true;
    for (const raw of lines) {
      const line = raw.trim();
      if (inHead && (line.startsWith("select") || line.startsWith("where") || line.startsWith("order") || line.startsWith("limit") || line.startsWith("--") || line === "")) {
        if (line.startsWith("--")) continue; // 注释行
        if (line === "") { if (meta.select) inHead = false; continue; }
        applyMetaLine(meta, line.replace(/^(select|where|order|limit)\s+/, "$1: "));
        continue;
      }
      inHead = false;
      rest.push(raw);
    }
    body = rest.join("\n");
  }
  return { meta, body: body.trim() };
}

function applyMetaLine(meta: TemplateMeta, line: string): void {
  const kv = /^\s*(select|where|order|limit)\s*:\s*(.+?)\s*$/.exec(line);
  if (!kv) return;
  const [, key, val] = kv;
  if (key === "select") meta.select = firstEntity(val);
  else if (key === "order") meta.order = val;
  else if (key === "limit") meta.limit = Number(val) || undefined;
  else if (key === "where") {
    const w = WHERE_RE.exec(val);
    if (w) meta.where = { attr: w[1], op: w[2], value: stripQuotes(w[3]) };
  }
}

// select 值可能是 `张三.HP, 张三.金钱`（原型宽松态列了具体 cell）——取首个 token 的 entity 段。
function firstEntity(val: string): string {
  const first = val.split(",")[0].trim();
  return stripQuotes(first.split(".")[0].trim());
}
function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

export interface CardRecord {
  entity: string;
  // attr → { value, visible }
  cells: Record<string, { value: string; visible: number }>;
}

// 跑 select：从 sheets 里挑出匹配 entity 的记录。where 对该 entity 的某 cell 过滤。
// diyOnlyVisible=true 时只纳入 visible=1 的 cell（DIY 边界 C3）。
export function runSelect(meta: TemplateMeta, sheets: SheetGroup[], diyOnlyVisible = false): CardRecord[] {
  if (!meta.select) return [];
  const groups = sheets.filter((g) => g.entity === meta.select);
  const records: CardRecord[] = [];
  for (const g of groups) {
    const cells: Record<string, { value: string; visible: number }> = {};
    for (const c of g.cells) {
      if (diyOnlyVisible && c.visible !== 1) continue;
      cells[c.attr] = { value: c.value, visible: c.visible };
    }
    const rec: CardRecord = { entity: g.entity, cells };
    if (meta.where && !passesWhere(rec, meta.where)) continue;
    records.push(rec);
  }
  return records;
}

function passesWhere(rec: CardRecord, w: { attr: string; op: string; value: string }): boolean {
  const cell = rec.cells[w.attr];
  if (!cell) return false;
  const lhsNum = Number(cell.value);
  const rhsNum = Number(w.value);
  const bothNum = !Number.isNaN(lhsNum) && !Number.isNaN(rhsNum);
  switch (w.op) {
    case "==": return cell.value === w.value;
    case "!=": return cell.value !== w.value;
    case ">": return bothNum && lhsNum > rhsNum;
    case "<": return bothNum && lhsNum < rhsNum;
    case ">=": return bothNum && lhsNum >= rhsNum;
    case "<=": return bothNum && lhsNum <= rhsNum;
    case "contains": return cell.value.includes(w.value);
    default: return true;
  }
}

// 插值展开 body → 最终 markdown 串。records 为空则返回 null（count=0 → 不渲染 card）。
// 未命中的 ${attr} 替换为空串（DIY 里 visible=0 的 cell 已被 runSelect 剔除 → 命中不到 → 留空）。
export function expandTemplate(body: string, records: CardRecord[]): string | null {
  if (records.length === 0) return null;
  let out = body;

  // ${#each <select>}...${{/each}}：对所有 records 展开内块。
  out = out.replace(/\$\{#each[^}]*\}([\s\S]*?)\$\{\{\/each\}\}/g, (_m, inner: string) =>
    records.map((r) => interpolateOne(inner, r)).join("\n"));

  // 顶层用首条记录插值（标量场景）。
  out = interpolateOne(out, records[0]);
  return out.trim();
}

// 单记录插值：条件块 → 循环剩余 → ${attr}。
function interpolateOne(tpl: string, rec: CardRecord): string {
  let s = tpl;
  // 条件块 ${{<expr>}}...${{/if}}：expr 形如 "${hp} < 10"（expr 内含 ${..} 的单 }，故非贪婪到首个 }}）。
  s = s.replace(/\$\{\{([\s\S]*?)\}\}([\s\S]*?)\$\{\{\/if\}\}/g, (_m, expr: string, inner: string) =>
    evalCondition(expr, rec) ? inner : "");
  // ${attr}：取该记录 cell 值（缺 → 空串）。
  s = s.replace(/\$\{([^}#/][^}]*)\}/g, (_m, attr: string) => {
    const key = attr.trim();
    return rec.cells[key]?.value ?? "";
  });
  return s;
}

function evalCondition(expr: string, rec: CardRecord): boolean {
  const m = /\$\{([^}]+)\}\s*(==|!=|>=|<=|>|<)\s*(.+)/.exec(expr.trim());
  if (!m) return true;
  const lhs = rec.cells[m[1].trim()]?.value ?? "";
  return passesWhere(rec, { attr: m[1].trim(), op: m[2], value: stripQuotes(m[3]) }) || (m[2] === "==" && lhs === stripQuotes(m[3]));
}

export interface Visual { kind: "dial" | "bar"; attr: string; value: number }

// 从最终 markdown 串里抽出 ![dial](attr)/![bar](attr) 可视化组件 + 数值（查首条记录 cell）。
// 返回 { markdown(剔除可视化标记后的串), visuals }。渲染层据 visuals 插 dial/bar 组件。
export function extractVisuals(md: string, rec: CardRecord | undefined): { markdown: string; visuals: Visual[] } {
  const visuals: Visual[] = [];
  const markdown = md.replace(/!\[(dial|bar)\]\(([^)]+)\)/g, (_m, kind: "dial" | "bar", attr: string) => {
    const raw = rec?.cells[attr.trim()]?.value ?? "0";
    visuals.push({ kind, attr: attr.trim(), value: Number(raw) || 0 });
    return "";
  });
  return { markdown: markdown.trim(), visuals };
}

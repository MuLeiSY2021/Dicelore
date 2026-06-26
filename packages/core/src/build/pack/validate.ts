// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PackFile } from "../../catalog/catalog.js";
import { compileTool, type ToolDecl } from "../../toolgen/compile.js";

// ── 公开类型 ────────────────────────────────────────────────────────────────
export interface ValidateIssue { level: "error" | "warn"; file: string; msg: string; hint?: string }
export interface ValidateReport { ok: boolean; issues: ValidateIssue[] }

// ── 允许的顶层路径段 ──────────────────────────────────────────────────────
const KNOWN_TOP = new Set([
  "lore", "rules", "world", "pools", "params", "sheets", "fronts",
  "plotlines", "foreshadows", "anchors", // 叙事域 CSV
  "tools",          // 作者面：tools/*.json 携带声明式 toolgen 工具声明(DT-9 作者侧)
  "state",          // legacy: Draft.toPackFiles() 生成的旧格式
  "manifest.md",    // legacy: Draft.toPackFiles() 生成的旧格式
  "manifest.yaml",  // 新格式
  "prologue.md",    // 团本开场白 prompt（必填）
]);

// ── 极简 CSV 解析（与 import.ts 保持一致）────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let f = "", row: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); f = ""; row = []; }
    else if (c === "\r") { /* skip */ }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  if (rows.length === 0) return [];
  const h = rows[0];
  return rows.slice(1).filter((r) => r.some((v) => v !== "")).map((r) => {
    const o: Record<string, string> = {};
    h.forEach((k, i) => { o[k] = r[i] ?? ""; });
    return o;
  });
}

// ── 极简 YAML 解析（只针对 manifest.yaml 的扁平结构 + 短列表）──────────
// 支持: key: value, key: (下面 - item 列表), 不支持嵌套 map。
function parseManifestYaml(text: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = text.split("\n");
  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    // list item
    const listMatch = line.match(/^(\s+)-\s+(.+)$/);
    if (listMatch && currentList !== null) {
      currentList.push(listMatch[2].trim());
      continue;
    }
    // key: value (or key: (empty = start of list))
    const kvMatch = line.match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      // flush previous list
      if (currentKey !== null && currentList !== null) {
        result[currentKey] = currentList;
      }
      const key = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "" || val === "|" || val === ">") {
        // potential list or block scalar — treat as start of list
        currentKey = key;
        currentList = [];
      } else if (val.startsWith("[")) {
        // inline list: [a, b, c]
        currentKey = null; currentList = null;
        const inner = val.replace(/^\[/, "").replace(/\]$/, "");
        result[key] = inner.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        currentKey = null; currentList = null;
        result[key] = val;
      }
      if (currentList !== null) { /* keep accumulating */ }
      else currentKey = null;
      continue;
    }
    // empty or comment
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    // non-list non-kv lines inside a list block → stop collecting
    if (currentList !== null) {
      if (currentKey !== null) result[currentKey] = currentList;
      currentKey = null; currentList = null;
    }
  }
  if (currentKey !== null && currentList !== null) result[currentKey] = currentList;
  return result;
}

// ── frontmatter 解析（fronts/*.md）───────────────────────────────────────
/** 解析 YAML frontmatter(--- ... ---) + body。供 import.ts 物化 fronts/*.md 共用。 */
export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const yamlBlock = content.slice(3, end).replace(/^[\r\n]+/, "");
  const body = content.slice(end + 4);
  const meta: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  return { meta, body };
}

/** 完整解析 fronts/*.md → 结构化 front 数据（clock、阶梯、H1 name）。供 import.ts 物化共用。 */
export interface ParsedFront {
  clock: string;
  min: number;
  max: number;
  mode: "once" | "repeat";
  visible?: number;
  name: string;
  omens: { threshold: number; payload: string }[];
}export function parseFront(content: string): ParsedFront | null {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const { meta, body } = parsed;
  const clock = meta.clock?.trim() ?? "";
  const min = meta.min !== undefined ? Number(meta.min) : 0;
  const max = meta.max !== undefined ? Number(meta.max) : 0;
  const mode: "once" | "repeat" = meta.mode === "repeat" ? "repeat" : "once";
  const visible = meta.visible !== undefined ? Number(meta.visible) : undefined;
  const nameMatch = /^#\s+(.+)$/m.exec(body);
  const name = nameMatch?.[1]?.trim() ?? clock;
  const tableRows = extractMarkdownTableRows(body) ?? [];
  const omens: { threshold: number; payload: string }[] = [];
  for (const row of tableRows) {
    const cols = row.map((c) => c.trim()).filter((c) => c !== "");
    if (cols.length >= 2) {
      const threshold = Number(cols[0]);
      if (!isNaN(threshold)) {
        omens.push({ threshold, payload: cols[1] });
      }
    }
  }
  return { clock, min, max, mode, visible, name, omens };
}

// ── 辅助：从所有 sheets/ + state/ CSV 提取已知 (entity, attr) 对 ────────
function collectSheetAttrs(files: PackFile[]): Set<string> {
  const attrs = new Set<string>();
  for (const f of files) {
    if (f.path.startsWith("sheets/") || f.path.startsWith("state/")) {
      const rows = parseCsv(f.content);
      for (const r of rows) {
        if (r.entity && r.attr) attrs.add(`${r.entity}.${r.attr}`);
      }
    }
  }
  return attrs;
}

// ── semver 宽松校验（major.minor.patch）──────────────────────────────────
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

// ── 作者面 tools/*.json：声明式 toolgen 工具声明 ──────────────────────────
// DT-9 作者侧。团本作者在 pack 的 tools/<name>.json 写 ToolDecl[]，import/开局时经
// toolgenToToolDef 编译装进本 session 的 MCP。安全边界：**复用 toolgen 的 compileTool 校验**
// （读=assertReadOnlySelect 只读 SELECT；写=matchWrite 三封闭模式 mutate/setStatus/insert），
// 拒绝任意 handler / 危险 SQL（DROP/ATTACH/PRAGMA、多语句、JOIN/OR/子查询、非叙事表 INSERT）。
// 单源：此处只解析 + 调 compileTool 收集错误；编译规则的权威在 toolgen，绝不在此另造弱校验。

/** 一个 tools/*.json 的解析结果：合法则 decls 为声明数组，非法（JSON 坏 / 非数组）则 error 描述。 */
export interface ParsedToolsFile {
  decls?: ToolDecl[];
  error?: string;
}

/** 解析单个 tools/*.json 文件内容为 ToolDecl[]。供 validate + import 共用（单源）。 */
export function parseToolsFile(content: string): ParsedToolsFile {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (e) {
    return { error: `JSON 解析失败: ${(e as Error).message}` };
  }
  if (!Array.isArray(json)) {
    return { error: "tools 文件须为 ToolDecl 数组（JSON array）" };
  }
  const decls: ToolDecl[] = [];
  for (const [i, raw] of json.entries()) {
    if (typeof raw !== "object" || raw === null) {
      return { error: `第 ${i} 项不是对象` };
    }
    const d = raw as Record<string, unknown>;
    if (typeof d.name !== "string" || d.name.trim() === "") {
      return { error: `第 ${i} 项缺 name（字符串）` };
    }
    if (typeof d.sql !== "string" || d.sql.trim() === "") {
      return { error: `工具「${d.name}」缺 sql（字符串）` };
    }
    if (d.desc !== undefined && typeof d.desc !== "string") {
      return { error: `工具「${d.name}」的 desc 须为字符串` };
    }
    if (d.params !== undefined) {
      if (typeof d.params !== "object" || d.params === null || Array.isArray(d.params)) {
        return { error: `工具「${d.name}」的 params 须为 {名:类型} 对象` };
      }
      for (const [k, v] of Object.entries(d.params)) {
        if (typeof v !== "string") return { error: `工具「${d.name}」参数「${k}」类型须为字符串字面量` };
      }
    }
    decls.push(d as unknown as ToolDecl);
  }
  return { decls };
}

// ── 主校验函数 ────────────────────────────────────────────────────────────
export function validatePack(files: PackFile[]): ValidateReport {
  const issues: ValidateIssue[] = [];

  function err(file: string, msg: string, hint?: string): void {
    issues.push({ level: "error", file, msg, hint });
  }
  function warn(file: string, msg: string, hint?: string): void {
    issues.push({ level: "warn", file, msg, hint });
  }

  // ── Rule 0: 空包 ──────────────────────────────────────────────────────
  if (files.length === 0) {
    err("(pack)", "空团本包");
    return { ok: false, issues };
  }

  // ── Rule 0b: 未知顶层路径段 ───────────────────────────────────────────
  for (const f of files) {
    const top = f.path.indexOf("/") === -1 ? f.path : f.path.slice(0, f.path.indexOf("/"));
    if (!KNOWN_TOP.has(top)) {
      err(f.path, `未知顶层路径段「${top}」(允许: ${[...KNOWN_TOP].join(", ")})`);
    }
  }

  // ── Rule 0c: prologue.md 必须存在 ─────────────────────────────────────
  const hasPrologue = files.some((f) => f.path === "prologue.md");
  if (!hasPrologue) {
    err("prologue.md", "团本必须有开场白 prologue.md", "用 dicelore_build_set_prologue 写入团本开场 prompt（可以是固定台词、导调 MCP 的指令、或让 agent 即兴的指导语）");
  }

  // ── Rule 5a: state/ CSV 列（backward compat）─────────────────────────
  for (const f of files) {
    if (f.path.startsWith("state/")) {
      const rows = parseCsv(f.content);
      if (rows.length && !("entity" in rows[0] && "attr" in rows[0] && "value" in rows[0])) {
        err(f.path, "state CSV 缺 entity/attr/value 列");
      }
    }
  }

  // ── Rule 5b: sheets/ CSV 列 ───────────────────────────────────────────
  for (const f of files) {
    if (f.path.startsWith("sheets/")) {
      const rows = parseCsv(f.content);
      if (rows.length && !("entity" in rows[0] && "attr" in rows[0] && "value" in rows[0])) {
        err(f.path, "sheets CSV 缺 entity/attr/value 列");
      }
    }
  }

  // ── Rule 5c: 叙事域 CSV 必需列 ───────────────────────────────────────
  const NARRATIVE_REQ: Record<string, string[]> = {
    plotlines:   ["id", "title"],
    foreshadows: ["id", "content"],
    anchors:     ["owner_table", "owner_id", "target_table", "target_id"],
  };
  for (const f of files) {
    const top = f.path.indexOf("/") === -1 ? f.path : f.path.slice(0, f.path.indexOf("/"));
    const req = NARRATIVE_REQ[top];
    if (req) {
      const rows = parseCsv(f.content);
      if (rows.length && !req.every((c) => c in rows[0])) {
        err(f.path, `${top} CSV 缺必需列(需 ${req.join("/")})`, `请确保 CSV 首行包含: ${req.join(", ")}`);
      }
    }
  }

  // ── Rule 8: 作者面 tools/*.json 声明式工具（DT-9 安全闸门）─────────────
  // 复用 toolgen 的 compileTool 做编译期校验——任何危险 SQL / 不可映射形状直接 throw → 转 error。
  const seenToolNames = new Map<string, string>(); // name → 首次出现的 file，查重
  for (const f of files) {
    if (topSegOf(f.path) !== "tools") continue;
    if (!f.path.endsWith(".json")) {
      err(f.path, "tools/ 下只接受 .json 声明文件", "把工具声明写成 tools/<name>.json（ToolDecl 数组）");
      continue;
    }
    const parsed = parseToolsFile(f.content);
    if (parsed.error || !parsed.decls) {
      err(f.path, `tools 声明解析失败: ${parsed.error}`, '格式: [{ "name": "...", "desc": "...", "params": {"k":"string"}, "sql": "..." }]');
      continue;
    }
    for (const decl of parsed.decls) {
      // 查重：同名工具（跨文件）拒绝，避免装载时后者覆盖前者。
      const prev = seenToolNames.get(decl.name);
      if (prev) {
        err(f.path, `tools 工具名「${decl.name}」重复（已在 ${prev} 声明）`, "工具名须在团本内唯一");
        continue;
      }
      seenToolNames.set(decl.name, f.path);
      // 安全闸门：交给 toolgen 唯一权威校验。读=只读 SELECT；写=三封闭模式。任何逃逸都在此被拒。
      try {
        compileTool(decl);
      } catch (e) {
        err(f.path, `工具「${decl.name}」声明非法（toolgen 拒绝）: ${(e as Error).message}`, "只允许声明式工具：只读 SELECT，或 mutate/setStatus/insert 三模式；禁任意 SQL/DROP/ATTACH/多语句/JOIN/子查询");
      }
    }
  }

  // ── manifest.yaml 校验（Rules 1-4）────────────────────────────────────
  const manifestYamlFile = files.find((f) => f.path === "manifest.yaml");  if (manifestYamlFile) {
    const m = parseManifestYaml(manifestYamlFile.content);
    const mPath = "manifest.yaml";

    // Rule 1: 必填字段 id, name
    if (!m.id || (typeof m.id === "string" && m.id.trim() === "")) {
      err(mPath, "manifest 缺必填字段 id", "在 manifest.yaml 中添加 id: <唯一标识>");
    }
    if (!m.name || (typeof m.name === "string" && m.name.trim() === "")) {
      err(mPath, "manifest 缺必填字段 name", "在 manifest.yaml 中添加 name: <团本名称>");
    }

    // Rule 1: version 格式
    if (m.version && typeof m.version === "string" && !SEMVER_RE.test(m.version.trim())) {
      warn(mPath, `manifest version「${m.version}」不符合 semver 格式(major.minor.patch)`, "示例: version: 1.0.0");
    }

    // Rule 1: flows 须为数组
    if (m.flows !== undefined) {
      if (!Array.isArray(m.flows)) {
        err(mPath, "manifest flows 应为列表格式", "示例:\nflows:\n  - dicelore-flow-gacha");
      } else {
        // Rule 2: flows 引用完整性（已知 skill 前缀为 dicelore-flow-）
        for (const flow of m.flows) {
          if (typeof flow === "string" && !flow.startsWith("dicelore-flow-")) {
            warn(mPath, `flows 引用「${flow}」不以 dicelore-flow- 开头，可能是未知 flow skill`, `已知 flow 前缀: dicelore-flow-`);
          }
        }
      }
    }

    // Rule 3: manifest.clock attr 存在性
    if (m.clock && typeof m.clock === "string") {
      const clockAttr = m.clock.trim();
      const sheetAttrs = collectSheetAttrs(files);
      if (!sheetAttrs.has(clockAttr)) {
        warn(mPath, `manifest.clock「${clockAttr}」未在 sheets/ 或 state/ 中定义`, "在 sheets/开局.csv 中添加对应的钟 attr 行");
      }
    }

    // Rule 4: manifest.entry 锚点可解析
    if (m.entry && typeof m.entry === "string") {
      const entry = m.entry.trim();
      const hashIdx = entry.indexOf("#");
      const filePath = hashIdx === -1 ? entry : entry.slice(0, hashIdx);
      const anchor = hashIdx === -1 ? null : entry.slice(hashIdx + 1);
      const targetFile = files.find((f) => f.path === filePath);
      if (!targetFile) {
        err(mPath, `manifest.entry「${entry}」指向的文件「${filePath}」在包中不存在`, "检查 entry 路径是否正确，或在 world/ 下添加对应文件");
      } else if (anchor !== null) {
        // Check anchor exists: either as ## heading or as {#id}
        const anchorNorm = anchor.toLowerCase().replace(/\s+/g, "-");
        // Match markdown headings: "# 标题" / "## 引子" etc. (normalize CJK heading to kebab won't work, check raw)
        const headingPattern = new RegExp(`^#{1,6}\\s+${escapeRegex(anchor)}\\s*$`, "m");
        const idPattern = new RegExp(`\\{#${escapeRegex(anchorNorm)}\\}`, "m");
        if (!headingPattern.test(targetFile.content) && !idPattern.test(targetFile.content)) {
          err(mPath, `manifest.entry「${entry}」的 #锚点「${anchor}」在「${filePath}」中不存在`, "在目标文件中添加对应的标题或 {#id} 锚点");
        }
      }
    }
  }

  // ── Rule 6 + 7: fronts/*.md ───────────────────────────────────────────
  const sheetAttrs = collectSheetAttrs(files);
  for (const f of files) {
    if (!f.path.startsWith("fronts/")) continue;
    const parsed = parseFrontmatter(f.content);
    if (!parsed) {
      err(f.path, "fronts 文件缺少 YAML frontmatter (--- ... ---)", "参考格式: ---\nclock: 世界.入侵\nmin: 0\nmax: 8\nmode: once\n---");
      continue;
    }
    const { meta, body } = parsed;

    // Rule 6a: clock 必填
    if (!meta.clock || meta.clock.trim() === "") {
      err(f.path, "fronts frontmatter 缺必填字段 clock");
    }

    // Rule 6b: min/max 合法性
    const minVal = meta.min !== undefined ? Number(meta.min) : NaN;
    const maxVal = meta.max !== undefined ? Number(meta.max) : NaN;
    if (meta.max !== undefined && isNaN(maxVal)) {
      err(f.path, `fronts frontmatter 的 max「${meta.max}」不是有效数字`);
    }
    if (meta.min !== undefined && isNaN(minVal)) {
      err(f.path, `fronts frontmatter 的 min「${meta.min}」不是有效数字`);
    }
    if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
      err(f.path, `fronts frontmatter 的 min(${minVal}) > max(${maxVal})，范围无效`);
    }

    // Rule 6c: mode 合法值
    if (meta.mode !== undefined && meta.mode !== "once" && meta.mode !== "repeat") {
      err(f.path, `fronts frontmatter 的 mode「${meta.mode}」无效，应为 once 或 repeat`);
    }

    // Rule 6d: 凶兆阶梯每行有钟值+payload（若存在阶梯表）
    // 检查是否有凶兆阶梯 markdown 表格，且每个数据行都有至少 2 列（钟值 + 凶兆）
    const tableRows = extractMarkdownTableRows(body);
    if (tableRows !== null) {
      // tableRows = data rows (header already stripped)
      for (const row of tableRows) {
        const cols = row.filter((c) => c.trim() !== "");
        if (cols.length < 2) {
          err(f.path, "fronts 凶兆阶梯表格的数据行应有「钟值」和「凶兆」两列");
          break;
        }
        // First col should be a number (clock value)
        if (isNaN(Number(cols[0].trim()))) {
          err(f.path, `fronts 凶兆阶梯表格行的钟值「${cols[0].trim()}」不是有效数字`);
          break;
        }
      }
    }

    // Rule 7: front clock attr 引用完整性
    if (meta.clock && meta.clock.trim() !== "") {
      const clockAttr = meta.clock.trim();
      if (!sheetAttrs.has(clockAttr)) {
        warn(f.path, `front 声明的 clock attr「${clockAttr}」未在 sheets/ 或 state/ 中定义`, "在 sheets/开局.csv 中添加对应的钟 attr 行，或忽略此警告（运行时 import 会自动建立）");
      }
    }
  }

  return { ok: !issues.some((i) => i.level === "error"), issues };
}

// ── helpers ────────────────────────────────────────────────────────────────

function topSegOf(path: string): string {
  const i = path.indexOf("/");
  return i === -1 ? path : path.slice(0, i);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 提取 Markdown 表格的数据行（跳过表头行和分隔行）
// 返回 null 表示没有表格；返回 [] 表示有表格但无数据行。
function extractMarkdownTableRows(body: string): string[][] | null {
  const lines = body.split("\n");
  let inTable = false;
  let headerSeen = false;
  const dataRows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable) break; // table ended
      continue;
    }
    // It's a table line
    const cols = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|");
    if (!inTable) { inTable = true; headerSeen = false; continue; } // first line = header
    if (!headerSeen) {
      // separator line (---), skip
      if (cols.every((c) => /^[\s\-:]+$/.test(c))) { headerSeen = true; continue; }
    }
    if (headerSeen) {
      dataRows.push(cols);
    }
  }

  return inTable ? dataRows : null;
}

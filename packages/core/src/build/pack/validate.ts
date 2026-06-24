// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PackFile } from "../../catalog/catalog.js";

// ── 公开类型 ────────────────────────────────────────────────────────────────
export interface ValidateIssue { level: "error" | "warn"; file: string; msg: string; hint?: string }
export interface ValidateReport { ok: boolean; issues: ValidateIssue[] }

// ── 允许的顶层路径段 ──────────────────────────────────────────────────────
const KNOWN_TOP = new Set([
  "lore", "rules", "world", "pools", "params", "sheets", "fronts",
  "plotlines", "foreshadows", "anchors", // 叙事域 CSV
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

  // ── manifest.yaml 校验（Rules 1-4）────────────────────────────────────
  const manifestYamlFile = files.find((f) => f.path === "manifest.yaml");
  if (manifestYamlFile) {
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

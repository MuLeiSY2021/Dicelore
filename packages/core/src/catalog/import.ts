// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "../store/db.js";
import { loreUpsert } from "../store/world.js";
import { poolAdd } from "../store/world.js";
import { ruleUpsert } from "../store/rule.js";
import { checkout, type PackFile } from "./catalog.js";
import type { CatalogDB } from "./db.js";

// 团本包 → per-session 运行库的物化映射(对齐 数据层 spec §9,只覆已落域 lore/rule/pool/state)。
// 包路径约定: lore/<n>.md、rules/<n>.md、pools/<n>.csv、state/<n>.csv、manifest.md。
const KNOWN_TOP = new Set(["lore", "rules", "pools", "state", "manifest.md"]);

export interface ImportIssue { level: "error" | "warn"; path: string; msg: string }
export interface ImportResult { lore: number; rules: number; pools: number; stateCells: number }

function topSeg(path: string): string {
  const i = path.indexOf("/");
  return i === -1 ? path : path.slice(0, i);
}
function baseName(path: string): string {
  return path.split("/").pop()!.replace(/\.(md|csv)$/, "");
}

// 极简 CSV:首行表头,带引号字段("" 转义/逗号/换行)。
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

// 信任闸门:永不信任来源,跑起来前重验包结构。坏包 → ok:false。
export function validatePack(files: PackFile[]): { ok: boolean; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  if (files.length === 0) issues.push({ level: "error", path: "(pack)", msg: "空团本包" });
  for (const f of files) {
    if (!KNOWN_TOP.has(topSeg(f.path))) {
      issues.push({ level: "error", path: f.path, msg: `未知顶层路径段「${topSeg(f.path)}」(允许: ${[...KNOWN_TOP].join("/")})` });
    }
    if (f.path.startsWith("state/")) {
      const rows = parseCsv(f.content);
      if (rows.length && !("entity" in rows[0] && "attr" in rows[0] && "value" in rows[0])) {
        issues.push({ level: "error", path: f.path, msg: "state CSV 缺 entity/attr/value 列" });
      }
    }
  }
  return { ok: !issues.some((i) => i.level === "error"), issues };
}

const META_COLS = new Set(["weight", "source", "visible"]);

// 物化:checkout 某版本 → 校验(throw on error) → 按域写入运行库。caller 提供已 initSchema 的 runDB。
export function importPack(catalogDB: CatalogDB, runDB: DB, tuanbenId: string, ref: string): ImportResult {
  const files = checkout(catalogDB, tuanbenId, ref);
  const v = validatePack(files);
  if (!v.ok) {
    throw new Error(`团本包校验失败(信任闸门): ${v.issues.filter((i) => i.level === "error").map((i) => `${i.path}: ${i.msg}`).join("; ")}`);
  }
  const res: ImportResult = { lore: 0, rules: 0, pools: 0, stateCells: 0 };
  const stateStmt = runDB.prepare(
    `INSERT INTO state (entity, kind, attr, value, visible) VALUES (?,?,?,?,?)
     ON CONFLICT(entity, attr) DO UPDATE SET kind=excluded.kind, value=excluded.value, visible=excluded.visible`,
  );
  const tx = runDB.transaction(() => {
    for (const f of files) {
      const top = topSeg(f.path);
      if (top === "lore") { loreUpsert(runDB, { name: baseName(f.path), content: f.content, visible: 1 }); res.lore++; }
      else if (top === "rules") { ruleUpsert(runDB, { name: baseName(f.path), content: f.content }); res.rules++; }
      else if (top === "pools") {
        const pool = baseName(f.path);
        for (const r of parseCsv(f.content)) {
          const row: Record<string, string> = {};
          for (const [k, val] of Object.entries(r)) if (!META_COLS.has(k)) row[k] = val;
          poolAdd(runDB, {
            pool, row,
            weight: r.weight ? Number(r.weight) : undefined,
            source: r.source === "ai" ? "ai" : "author",
            visible: r.visible ? Number(r.visible) : undefined,
          });
          res.pools++;
        }
      } else if (top === "state") {
        for (const r of parseCsv(f.content)) {
          stateStmt.run(r.entity, r.kind || "world", r.attr, r.value, r.visible ? Number(r.visible) : 0);
          res.stateCells++;
        }
      }
      // manifest.md: 暂只作元信息载体,P5 接入 session_meta 时消费。
    }
  });
  tx();
  return res;
}

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
import { frontUpsert } from "../store/front.js";
import { plotlineUpsert } from "../store/plotline.js";
import { foreshadowUpsert } from "../store/foreshadow.js";
import { anchorAdd } from "../store/anchor.js";
import { checkout, type PackFile } from "./catalog.js";
import type { CatalogDB } from "./db.js";

// 团本包 → per-session 运行库的物化映射(对齐 数据层 spec §9)。
// 包路径约定: lore/<n>.md、rules/<n>.md、pools/<n>.csv、state/<n>.csv、manifest.md
//   + 叙事域 fronts/<n>.csv、plotlines/<n>.csv、foreshadows/<n>.csv、anchors/<n>.csv。
const KNOWN_TOP = new Set(["lore", "rules", "pools", "state", "fronts", "plotlines", "foreshadows", "anchors", "manifest.md", "prologue.md"]);

export interface ImportIssue { level: "error" | "warn"; path: string; msg: string }
export interface ImportResult {
  lore: number; rules: number; pools: number; stateCells: number;
  fronts: number; plotlines: number; foreshadows: number; anchors: number;
  prologue?: string;     // 包根 prologue.md 正文(团本开场 prompt;不物化进 store,回传供 session_meta)
  tuanbenName?: string;  // manifest.md H1(团本名,session_meta 兜底)
}

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
    const REQ: Record<string, string[]> = {
      fronts: ["id", "name"], plotlines: ["id", "title"], foreshadows: ["id", "content"],
      anchors: ["owner_table", "owner_id", "target_table", "target_id"],
    };
    const req = REQ[topSeg(f.path)];
    if (req) {
      const rows = parseCsv(f.content);
      if (rows.length && !req.every((c) => c in rows[0])) {
        issues.push({ level: "error", path: f.path, msg: `${topSeg(f.path)} CSV 缺必需列(需 ${req.join("/")})` });
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
  const res: ImportResult = { lore: 0, rules: 0, pools: 0, stateCells: 0, fronts: 0, plotlines: 0, foreshadows: 0, anchors: 0 };
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
      } else if (top === "fronts") {
        for (const r of parseCsv(f.content)) {
          frontUpsert(runDB, { id: r.id, name: r.name, stakes: r.stakes || undefined, clock_ref: r.clock_ref || undefined, status: r.status || undefined });
          res.fronts++;
        }
      } else if (top === "plotlines") {
        for (const r of parseCsv(f.content)) {
          plotlineUpsert(runDB, { id: r.id, title: r.title, summary: r.summary || undefined, status: r.status || undefined });
          res.plotlines++;
        }
      } else if (top === "foreshadows") {
        for (const r of parseCsv(f.content)) {
          foreshadowUpsert(runDB, { id: r.id, content: r.content, status: r.status || undefined });
          res.foreshadows++;
        }
      } else if (top === "anchors") {
        for (const r of parseCsv(f.content)) {
          anchorAdd(runDB, { owner_table: r.owner_table, owner_id: r.owner_id, target_table: r.target_table, target_id: r.target_id, role: r.role || undefined });
          res.anchors++;
        }
      } else if (f.path === "manifest.md") {
        const m = /^#\s+(.+)$/m.exec(f.content);
        if (m) res.tuanbenName = m[1].trim();
      } else if (f.path === "prologue.md") {
        res.prologue = f.content; // 团本开场 prompt:不物化进 store,回传供 session_meta
      }
    }
  });
  tx();
  return res;
}

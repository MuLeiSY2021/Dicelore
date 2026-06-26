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
import { stateSetClock } from "../store/state.js";
import { watcherSet } from "../store/watcher.js";
import { checkout, type PackFile } from "./catalog.js";
import type { CatalogDB } from "./db.js";
import { validatePack as validatePackFull, parseFrontmatter, parseFront, parseToolsFile, type ValidateIssue } from "../build/pack/validate.js";
import { toolgenToToolDef } from "../toolgen/toToolDef.js";
import type { ToolDef } from "../mcp/tooldef.js";

// 团本包 → per-session 运行库的物化映射(对齐 数据层 spec §9)。
// 包路径约定: lore/<n>.md、rules/<n>.md、pools/<n>.csv、state/<n>.csv、manifest.md
//   + 叙事域 fronts/<id>.md(正典 md 格式)、plotlines/<n>.csv、foreshadows/<n>.csv、anchors/<n>.csv、prologue.md。
// validatePack 实现集中在 build/pack/validate.ts(信任闸门 + 构建期 DX 报告),此处直接复用。

/** 包校验 issue（与 ValidateIssue 同构，`file` 为 issue 所属路径段）。 */
export type ImportIssue = ValidateIssue;
export interface ImportResult {
  lore: number; rules: number; pools: number; stateCells: number;
  fronts: number; plotlines: number; foreshadows: number; anchors: number;
  prologue?: string;     // 包根 prologue.md 正文(团本开场 prompt;不物化进 store,回传供 session_meta)
  tuanbenName?: string;  // manifest.md H1(团本名,session_meta 兜底)
  /**
   * 作者面声明式工具（DT-9 作者侧）。pack 的 tools/*.json 声明经 toolgenToToolDef 编译为运行时 ToolDef，
   * 不物化进 store——回传供创建本 session 的 createMcpServer(db, deps, extraTools) 经 extraTools 注入。
   * 安全已在 validatePack（信任闸门）经 toolgen compileTool 守住；坏声明在 import 前就抛错，永不到这。
   */
  toolDefs: ToolDef[];
}

// 信任闸门:永不信任来源,跑起来前重验包结构。坏包 → ok:false。
// 单源:校验逻辑在 build/pack/validate.ts；此处只是转发，确保 importPack 与 /catalog/validate 共用同一实现。
export { validatePackFull as validatePack };

// ── 物化辅助函数 ────────────────────────────────────────────────────────────
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



const META_COLS = new Set(["weight", "source", "visible"]);

// 物化:checkout 某版本 → 校验(throw on error) → 按域写入运行库。caller 提供已 initSchema 的 runDB。
export function importPack(catalogDB: CatalogDB, runDB: DB, tuanbenId: string, ref: string): ImportResult {
  const files = checkout(catalogDB, tuanbenId, ref);
  const v = validatePackFull(files);
  if (!v.ok) {
    throw new Error(`团本包校验失败(信任闸门): ${v.issues.filter((i) => i.level === "error").map((i) => `${i.file}: ${i.msg}`).join("; ")}`);
  }
  const res: ImportResult = { lore: 0, rules: 0, pools: 0, stateCells: 0, fronts: 0, plotlines: 0, foreshadows: 0, anchors: 0, toolDefs: [] };
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
        // front 正典格式：fronts/<id>.md (YAML frontmatter + body)
        // 解析 → frontUpsert(front 表行 + clock_ref) + Clock 初始化 + 凶兆→watcher 预声明。
        const id = baseName(f.path);
        const front = parseFront(f.content);
        if (front) {
          // 1. front 表行
          frontUpsert(runDB, { id, name: front.name, clock_ref: front.clock, stakes: undefined, status: undefined });
          // 2. Clock 初始化：拆 clock → entity.attr，写 state + clock_min/max/mode
          const dotIdx = front.clock.indexOf(".");
          if (dotIdx !== -1) {
            const entity = front.clock.slice(0, dotIdx);
            const attr = front.clock.slice(dotIdx + 1);
            stateSetClock(runDB, entity, attr, {
              value: String(front.min),
              visible: front.visible ?? 1,
              clock_min: front.min,
              clock_max: front.max,
              clock_mode: front.mode,
            });
          }
          // 3. 凶兆阶梯 → 预声明 watcher（condition 格式对齐 orc-hunt-seed）
          for (const omen of front.omens) {
            watcherSet(runDB, {
              condition: `{${front.clock}} >= ${omen.threshold}`,
              payload: omen.payload,
              mode: front.mode,
              source: `front:${id}`,
            });
          }
        } else {
          // fallback: no frontmatter, just upsert id-only
          const parsed = parseFrontmatter(f.content);
          const clockRef = parsed?.meta.clock?.trim() || undefined;
          const nameMatch = /^#\s+(.+)$/m.exec(parsed?.body ?? f.content);
          const name = nameMatch?.[1]?.trim() ?? id;
          frontUpsert(runDB, { id, name, clock_ref: clockRef, stakes: undefined, status: undefined });
        }
        res.fronts++;
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
      } else if (top === "tools" && f.path.endsWith(".json")) {
        // 作者面声明式工具：不物化进 store。validatePack 已守安全闸门(compileTool 全过)，
        // 此处把声明经 toolgenToToolDef 编译为运行时 ToolDef，回传供 createMcpServer(extraTools) 注入。
        const parsed = parseToolsFile(f.content);
        for (const decl of parsed.decls ?? []) {
          res.toolDefs.push(toolgenToToolDef(decl));
        }
      }
    }
  });
  tx();
  return res;
}

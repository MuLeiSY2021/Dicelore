// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { commit, type PackFile } from "../catalog/catalog.js";
import type { CatalogDB } from "../catalog/db.js";

// 团本构建草稿:lore_agent 按域累积内容,toPackFiles 序列化成 P3 import 认的包格式,commit 到 Catalog。
// (harvest 旧 2026-06-21 build 读写层:文件式 packDir → 内存 draft → Catalog DB。)

function toCsv(rows: Record<string, string | number>[], cols?: string[]): string {
  const keys = cols ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = rows.map((r) => keys.map((k) => esc(r[k] ?? "")).join(",")).join("\n");
  return rows.length ? `${keys.join(",")}\n${body}\n` : `${keys.join(",")}\n`;
}

export interface StateCell { entity: string; kind?: "player" | "npc" | "world"; attr: string; value: string; visible?: number }

export interface FrontOmen { threshold: number; payload: string }
export interface FrontSpec {
  id: string;
  name: string;
  stakes?: string;
  clock_attr: string;
  clock_min: number;
  clock_max: number;
  clock_mode?: "once" | "repeat";
  omens: FrontOmen[];
}

/** fronts/<id>.md の YAML frontmatter + body を生成する。 */
function buildFrontMd(spec: FrontSpec): string {
  const mode = spec.clock_mode ?? "once";
  const frontmatter = [
    "---",
    `clock: ${spec.clock_attr}`,
    `min: ${spec.clock_min}`,
    `max: ${spec.clock_max}`,
    `mode: ${mode}`,
    "---",
  ].join("\n");

  const title = `# ${spec.name}`;

  const stakesSection = spec.stakes
    ? `\n**利害问题**：${spec.stakes}\n`
    : "";

  const omenRows = spec.omens
    .map((o) => `| ${o.threshold} | ${o.payload} |`)
    .join("\n");
  const omenTable =
    spec.omens.length > 0
      ? `\n## 凶兆阶梯\n\n| 钟值 | 凶兆（触发 payload） |\n|------|---------------------|\n${omenRows}\n`
      : "";

  return `${frontmatter}\n${title}\n${stakesSection}${omenTable}`;
}

export class Draft {
  private loreDocs = new Map<string, string>();
  private ruleDocs = new Map<string, string>();
  private pools = new Map<string, Record<string, string | number>[]>();
  private stateRows: StateCell[] = [];
  // front 正典格式：每个 Front 一个 .md 文件（FrontSpec → fronts/<id>.md）
  private fronts = new Map<string, FrontSpec>();
  // 叙事域 CSV：plotline 故事线 / foreshadow 伏笔 / anchor 关系（格式同 main）
  private plotlines: Record<string, string | number>[] = [];
  private foreshadows: Record<string, string | number>[] = [];
  private anchors: Record<string, string | number>[] = [];
  private manifestName?: string;
  private manifestId?: string;
  private prologueText?: string;

  setManifest(a: { name?: string; id?: string }): void {
    if (a.name) this.manifestName = a.name;
    if (a.id) this.manifestId = a.id;
  }

  /** 设置团本开场白 prompt（必填）。同名覆盖，幂等。 */
  setPrologue(text: string): void { this.prologueText = text; }
  writeLore(name: string, content: string): void { this.loreDocs.set(name, content); }
  writeRule(name: string, content: string): void { this.ruleDocs.set(name, content); }
  addPool(pool: string, rows: Record<string, string | number>[]): void {
    const e = this.pools.get(pool) ?? [];
    e.push(...rows);
    this.pools.set(pool, e);
  }
  setState(cells: StateCell[]): void { this.stateRows.push(...cells); }

  /** 累积一个 Front(阵线)。相同 id 的后调用覆盖前调用(幂等写)。产出 fronts/<id>.md（正典 md 格式）。 */
  addFront(spec: FrontSpec): void {
    this.fronts.set(spec.id, spec);
  }

  // 叙事域(团本作者声明的一等对象): plotline 故事线 / foreshadow 伏笔 / anchor 关系。
  addPlotline(rows: { id: string; title: string; summary?: string; status?: string }[]): void { this.plotlines.push(...rows); }
  addForeshadow(rows: { id: string; content: string; status?: string }[]): void { this.foreshadows.push(...rows); }
  addAnchor(rows: { owner_table: string; owner_id: string; target_table: string; target_id: string; role?: string }[]): void { this.anchors.push(...rows); }

  /** 回读 Draft 当前内容(供 read 工具)。 */
  snapshot(): {
    manifest: { name?: string; id?: string };
    prologue?: string;
    world: Record<string, string>;
    rules: Record<string, string>;
    pools: Record<string, Record<string, string | number>[]>;
    sheets: { cells: StateCell[] };
    fronts: Record<string, FrontSpec>;
    plotlines: Record<string, string | number>[];
    foreshadows: Record<string, string | number>[];
    anchors: Record<string, string | number>[];
  } {
    return {
      manifest: { name: this.manifestName, id: this.manifestId },
      prologue: this.prologueText,
      world: Object.fromEntries(this.loreDocs),
      rules: Object.fromEntries(this.ruleDocs),
      pools: Object.fromEntries(this.pools),
      sheets: { cells: [...this.stateRows] },
      fronts: Object.fromEntries(this.fronts),
      plotlines: [...this.plotlines],
      foreshadows: [...this.foreshadows],
      anchors: [...this.anchors],
    };
  }

  toPackFiles(): PackFile[] {
    const files: PackFile[] = [];
    if (this.manifestName || this.manifestId) {
      files.push({ path: "manifest.md", content: `# ${this.manifestName ?? "(未命名)"}\n\n- id: ${this.manifestId ?? ""}` });
    }
    if (this.prologueText !== undefined) {
      files.push({ path: "prologue.md", content: this.prologueText });
    }
    for (const [n, c] of this.loreDocs) files.push({ path: `lore/${n}.md`, content: c });
    for (const [n, c] of this.ruleDocs) files.push({ path: `rules/${n}.md`, content: c });
    for (const [p, rows] of this.pools) files.push({ path: `pools/${p}.csv`, content: toCsv(rows) });
    if (this.stateRows.length) {
      files.push({
        path: "state/开局.csv",
        content: toCsv(
          this.stateRows.map((c) => ({ entity: c.entity, kind: c.kind ?? "world", attr: c.attr, value: c.value, visible: c.visible ?? 0 })),
          ["entity", "kind", "attr", "value", "visible"],
        ),
      });
    }
    // front 正典格式：每个 Front 产出 fronts/<id>.md（YAML frontmatter + 凶兆阶梯表）
    for (const spec of this.fronts.values()) {
      files.push({ path: `fronts/${spec.id}.md`, content: buildFrontMd(spec) });
    }
    // 叙事域 CSV（plotline/foreshadow/anchor 保持 CSV 格式，同 main）
    if (this.plotlines.length) files.push({ path: "plotlines/main.csv", content: toCsv(this.plotlines, ["id", "title", "summary", "status"]) });
    if (this.foreshadows.length) files.push({ path: "foreshadows/main.csv", content: toCsv(this.foreshadows, ["id", "content", "status"]) });
    if (this.anchors.length) files.push({ path: "anchors/main.csv", content: toCsv(this.anchors, ["owner_table", "owner_id", "target_table", "target_id", "role"]) });
    return files;
  }
}

// 把草稿提交为团本一个版本(linear commit)。name 决定 UUIDv5 身份。
export function commitDraft(
  catalogDB: CatalogDB,
  a: { name: string; message: string; draft: Draft; createdAt?: string },
): { tuanbenId: string; commitId: string } {
  return commit(catalogDB, { name: a.name, files: a.draft.toPackFiles(), message: a.message, createdAt: a.createdAt });
}

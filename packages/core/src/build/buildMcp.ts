// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Draft, commitDraft, type FrontSpec } from "./draft.js";
import { tag, resolveId } from "../catalog/catalog.js";
import type { CatalogDB } from "../catalog/db.js";
import { initRetrieval, type RetrievalDB } from "./retrieval/db.js";
import { ingest } from "./retrieval/ingest.js";
import { searchMaterial } from "./retrieval/search.js";
import { validatePack } from "./pack/validate.js";

// 构建会话上下文:一个 Draft(跨工具调用累积) + Catalog + 团本名。lore_agent 在此造包。
export interface BuildCtx {
  catalog: CatalogDB;
  draft: Draft;
  name: string;
  /** 素材检索 DB（可选；由 ingest/search 按需 initRetrieval）。 */
  retrievalDb?: RetrievalDB;
}

export interface BuildEnvelope {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

function ok(out: unknown): BuildEnvelope {
  return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
}
function err(code: string, message: string): BuildEnvelope {
  return { content: [{ type: "text", text: JSON.stringify({ error: { code, message } }) }], isError: true };
}

const rowsSchema = z.array(z.record(z.union([z.string(), z.number()]))).min(1);
export const BUILD_SCHEMAS = {
  set_manifest: z.object({ name: z.string().optional(), id: z.string().optional() }).strict(),
  write_lore: z.object({ name: z.string(), content: z.string() }).strict(),
  write_rule: z.object({ name: z.string(), content: z.string() }).strict(),
  add_pool: z.object({ pool: z.string(), rows: rowsSchema }).strict(),
  set_state: z.object({
    cells: z.array(z.object({
      entity: z.string(),
      kind: z.enum(["player", "npc", "world"]).optional(),
      attr: z.string(), value: z.string(),
      visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    })).min(1),
  }).strict(),
  commit: z.object({ message: z.string() }).strict(),
  tag: z.object({ commitId: z.string(), label: z.string() }).strict(),
  // ── 新増 5 个工具（检索 + 校验 + 读取 + front md格式 + prologue）────────
  ingest: z.object({ text: z.string() }).strict(),
  search: z.object({ query: z.string(), k: z.number().int().positive().optional() }).strict(),
  validate: z.object({}).strict(),
  read: z.object({
    section: z.enum(["manifest", "world", "rules", "pools", "sheets", "fronts"]).optional(),
  }).strict(),
  add_front: z.object({
    id: z.string(),
    name: z.string(),
    stakes: z.string().optional(),
    clock_attr: z.string(),
    clock_min: z.number(),
    clock_max: z.number(),
    clock_mode: z.enum(["once", "repeat"]).optional(),
    omens: z.array(z.object({ threshold: z.number(), payload: z.string() })),
  }).strict(),
  set_prologue: z.object({ text: z.string() }).strict(),
  // ── 叙事域工具（plotline/foreshadow/anchor，来自 main）─────────────────
  add_plotline: z.object({ rows: z.array(z.object({
    id: z.string(), title: z.string(), summary: z.string().optional(), status: z.string().optional(),
  })).min(1) }).strict(),
  add_foreshadow: z.object({ rows: z.array(z.object({
    id: z.string(), content: z.string(), status: z.string().optional(),
  })).min(1) }).strict(),
  add_anchor: z.object({ rows: z.array(z.object({
    owner_table: z.string(), owner_id: z.string(), target_table: z.string(), target_id: z.string(), role: z.string().optional(),
  })).min(1) }).strict(),
} as const;

// 调一个构建工具(无 dicelore_build_ 前缀):校验入参 → 改 draft / commit。可测核心。
export function invokeBuildTool(ctx: BuildCtx, name: string, args: unknown): BuildEnvelope {
  const schema = (BUILD_SCHEMAS as Record<string, z.ZodTypeAny>)[name];
  if (!schema) return err("UNKNOWN_TOOL", `未知构建工具: ${name}`);
  const parsed = schema.safeParse(args);
  if (!parsed.success) return err("VALIDATION", parsed.error.message);
  const a = parsed.data as Record<string, unknown>;
  switch (name) {
    case "set_manifest": ctx.draft.setManifest(a); return ok({ ok: true });
    case "write_lore": ctx.draft.writeLore(a.name as string, a.content as string); return ok({ ok: true });
    case "write_rule": ctx.draft.writeRule(a.name as string, a.content as string); return ok({ ok: true });
    case "add_pool": ctx.draft.addPool(a.pool as string, a.rows as Record<string, string | number>[]); return ok({ ok: true });
    case "set_state": ctx.draft.setState(a.cells as Parameters<Draft["setState"]>[0]); return ok({ ok: true });
    case "commit": {
      const r = commitDraft(ctx.catalog, { name: ctx.name, message: a.message as string, draft: ctx.draft });
      return ok(r);
    }
    case "tag": tag(ctx.catalog, { tuanbenId: resolveId(ctx.name), commitId: a.commitId as string, label: a.label as string }); return ok({ ok: true });
    // ── 新增工具 ────────────────────────────────────────────────────────────
    case "ingest": {
      if (!ctx.retrievalDb) return err("NO_RETRIEVAL_DB", "BuildCtx 未设置 retrievalDb，无法 ingest");
      initRetrieval(ctx.retrievalDb);
      const chunks = ingest(ctx.retrievalDb, a.text as string);
      return ok({ chunks });
    }
    case "search": {
      if (!ctx.retrievalDb) return err("NO_RETRIEVAL_DB", "BuildCtx 未设置 retrievalDb，无法 search");
      const k = (a.k as number | undefined) ?? 8;
      const hits = searchMaterial(ctx.retrievalDb, a.query as string, k);
      return ok({ hits });
    }
    case "validate": {
      const files = ctx.draft.toPackFiles();
      const report = validatePack(files);
      return ok(report);
    }
    case "read": {
      const section = a.section as string | undefined;
      const snap = ctx.draft.snapshot();
      if (!section) return ok(snap);
      switch (section) {
        case "manifest": return ok({ manifest: snap.manifest });
        case "world": return ok({ world: snap.world });
        case "rules": return ok({ rules: snap.rules });
        case "pools": return ok({ pools: snap.pools });
        case "sheets": return ok({ sheets: snap.sheets });
        case "fronts": return ok({ fronts: snap.fronts });
        default: return err("INVALID_SECTION", `无效的 section: ${section}，允许: manifest/world/rules/pools/sheets/fronts`);
      }
    }
    case "add_front": {
      const spec: FrontSpec = {
        id: a.id as string,
        name: a.name as string,
        stakes: a.stakes as string | undefined,
        clock_attr: a.clock_attr as string,
        clock_min: a.clock_min as number,
        clock_max: a.clock_max as number,
        clock_mode: a.clock_mode as "once" | "repeat" | undefined,
        omens: a.omens as FrontSpec["omens"],
      };
      ctx.draft.addFront(spec);
      return ok({ ok: true });
    }
    case "set_prologue": ctx.draft.setPrologue(a.text as string); return ok({ ok: true });
    // ── 叙事域工具（plotline/foreshadow/anchor，来自 main）─────────────────
    case "add_plotline": ctx.draft.addPlotline(a.rows as Parameters<Draft["addPlotline"]>[0]); return ok({ ok: true });
    case "add_foreshadow": ctx.draft.addForeshadow(a.rows as Parameters<Draft["addForeshadow"]>[0]); return ok({ ok: true });
    case "add_anchor": ctx.draft.addAnchor(a.rows as Parameters<Draft["addAnchor"]>[0]); return ok({ ok: true });
    default: return err("UNKNOWN_TOOL", name);
  }
}

// 构建工具元数据（描述 + MCP annotations），与 BUILD_SCHEMAS 键一一对应。
const TOOL_META: Record<string, { description: string; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean } }> = {
  set_manifest: { description: "设置团本 manifest 字段（name/id）。多次调用只更新传入的字段，幂等。", annotations: { idempotentHint: true } },
  write_lore:   { description: "写入一篇 lore（世界观/NPC 人设）文档到 Draft。同名覆盖。", annotations: { idempotentHint: true } },
  write_rule:   { description: "写入一篇 rule（判定规则/机制）文档到 Draft。同名覆盖。", annotations: { idempotentHint: true } },
  add_pool:     { description: "追加行到随机池 CSV（world_pool）。非幂等——多次调用会追加行。", annotations: { destructiveHint: false } },
  set_state:    { description: "追加开局状态格（entity/attr/value）到 Draft。非幂等——多次调用追加行。", annotations: { destructiveHint: false } },
  commit:       { description: "把 Draft 当前内容作为一个版本提交到 Catalog（linear commit）。返回 tuanbenId + commitId。", annotations: { destructiveHint: false } },
  tag:          { description: "给 Catalog 中某 commitId 打标签（如 v1.0.0）。同名标签会覆盖。", annotations: { idempotentHint: true } },
  ingest:       { description: "将原著/素材文本切块后写入素材检索库（build_material）。追加语义——多次调用追加块，不覆盖。", annotations: { destructiveHint: false } },
  search:       { description: "在素材检索库中用 jieba BM25 全文搜索，返回 top-k 相关块（{ hits: [{idx, text}] }）。只读。", annotations: { readOnlyHint: true } },
  validate:     { description: "校验 Draft 当前内容是否符合团本包规范（manifest/fronts/CSV 列等）。返回 { ok, issues }。只读。", annotations: { readOnlyHint: true } },
  read:         { description: "回读 Draft 当前内容（供审阅）。section 可选：manifest/world/rules/pools/sheets/fronts；省略返回全部。只读。", annotations: { readOnlyHint: true } },
  add_front:     { description: "添加/覆写一个 Front（阵线）到 Draft，产出 fronts/<id>.md（frontmatter 声明 Clock + 凶兆阶梯表）。同 id 覆盖，幂等。", annotations: { idempotentHint: true } },
  set_prologue:  { description: "设置团本开场白 prompt（**必填**）。prologue.md 是 GM agent 开局时执行的第一个 prompt——可以是一句固定台词、导调 MCP 的指令、或让 agent 基于团本即兴发挥的指导语。覆盖写，幂等。团本无 prologue 不合法（validate 会报 error）。", annotations: { idempotentHint: true } },
  // 叙事域工具（plotline/foreshadow/anchor，来自 main）
  add_plotline:  { description: "追加故事线（plotline）行到 Draft，产出 plotlines/main.csv。非幂等——多次调用追加行。", annotations: { destructiveHint: false } },
  add_foreshadow:{ description: "追加伏笔（foreshadow）行到 Draft，产出 foreshadows/main.csv。非幂等——多次调用追加行。", annotations: { destructiveHint: false } },
  add_anchor:    { description: "追加关系锚点（anchor）行到 Draft，产出 anchors/main.csv。非幂等——多次调用追加行。", annotations: { destructiveHint: false } },
};

// 构建版 MCP server:注册 dicelore_build_* 工具,挂在 LoreSession 的 in-process MCP。
// 与运行时 TOOLS 编译期不交叉(物理隔离不变量:lore 会话只见构建工具)。
export function createBuildMcpServer(ctx: BuildCtx): McpServer {
  const server = new McpServer({ name: "dicelore-build", version: "0.0.0" });
  for (const [name, schema] of Object.entries(BUILD_SCHEMAS)) {
    const meta = TOOL_META[name] ?? { description: `团本构建:${name}` };
    server.registerTool(
      `dicelore_build_${name}`,
      { description: meta.description, inputSchema: (schema as z.ZodObject<z.ZodRawShape>).shape, annotations: meta.annotations },
      (args: unknown) => invokeBuildTool(ctx, name, args) as never,
    );
  }
  return server;
}

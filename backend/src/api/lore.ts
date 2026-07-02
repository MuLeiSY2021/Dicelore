// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { list, commit, tag, checkout, validatePack, createBuildMcpServer, Draft, type CatalogDB, type PackFile } from "@dicelore/backend";
import { LoreSession, type LoreSessionDeps, type AgentFactory, type PluginRef } from "@dicelore/harness";

export interface LoreDeps {
  catalog: CatalogDB;
  agentFactory: AgentFactory; // CC SDK 适配器挂构建 MCP + 构建 skill
  buildPrompt?: string; // 构建教条(→ openingPrompt)
  plugin?: PluginRef; // 构建 skill plugin(build-pack+build-core,boot 期物化到 $/lore)
}

// 组合根持 { session, draft }:Draft + 构建 MCP 在此建好(backend 可 import createBuildMcpServer/Draft),
// mcpServer 注入 LoreSession(loregm 保持 backend-free);draft 只读端点经此处的 Draft 读(LoreSession 不持 Draft)。
// 用裸 Map(非 InMemorySessionRegistry:其约束 S extends Session,而此处存的是 session+draft 复合条目)。
const loreReg = new Map<string, { session: LoreSession; draft: Draft }>();

// lore 路径 server 面:Catalog 管理(列/建/发布) + 构建会话(agent 造包)。
// 与 dice /sessions 路由物理分离(/lore/*、/catalog)。
export function createLoreApp(deps: LoreDeps): Hono {
  const app = new Hono();

  // 团本目录录(主页选团本玩 / 构建台列表)
  app.get("/catalog", (c) => c.json({ adventure: list(deps.catalog) }));

  // 直接提交一个团本版本(程序化建包:种子/前端表单;agent 路径见 /lore-sessions)
  app.post("/catalog/commit", async (c) => {
    const body = (await c.req.json()) as { name: string; message: string; files: PackFile[] };
    const r = commit(deps.catalog, { name: body.name, message: body.message, files: body.files });
    return c.json(r, 201);
  });

  // 读某团本版本的全部包文件(团本制作页中央编辑器渲染来源)。ref 缺省=head。
  // §3 BE-checkout-head: core checkout 只认 tag label / commitId、不认 "head" 关键字,
  // 故 ref 省略或 = "head" 时在端点层先从 catalog list 取该 adventure 的 head commitId 再 checkout
  // (不动 core checkout 语义)。head 为 null(未知/空团本)时返 []。
  app.get("/catalog/:adventureId/files", (c) => {
    const adventureId = c.req.param("adventureId");
    const ref = c.req.query("ref") ?? "head";
    if (ref === "head") {
      const head = list(deps.catalog).find((a) => a.id === adventureId)?.head;
      if (!head) return c.json({ files: [] });
      return c.json({ files: checkout(deps.catalog, adventureId, head) });
    }
    const files = checkout(deps.catalog, adventureId, ref);
    return c.json({ files });
  });

  // 整包校验(团本制作页右栏校验报告)。body {files}。
  app.post("/catalog/validate", async (c) => {
    const body = (await c.req.json()) as { files: PackFile[] };
    return c.json(validatePack(body.files ?? []));
  });

  // 打 tag(真发布)
  app.post("/catalog/:adventureId/tag", async (c) => {
    const body = (await c.req.json()) as { commitId: string; label: string };
    tag(deps.catalog, { adventureId: c.req.param("adventureId"), commitId: body.commitId, label: body.label });
    return c.json({ ok: true }, 201);
  });

  // 构建会话:agent 经构建 MCP 造包(需 LLM driver)
  app.post("/lore-sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as { text: string; name: string };
    let entry = loreReg.get(id);
    if (!entry) {
      // 组合根建 Draft + 构建 MCP server(BUILD_TOOLS over Draft+Catalog),注入 LoreSession。
      const draft = new Draft();
      const mcpServer = createBuildMcpServer({ catalog: deps.catalog, draft, name: body.name });
      const dep: LoreSessionDeps = { mcpServer, agentFactory: deps.agentFactory, buildPrompt: deps.buildPrompt, plugin: deps.plugin };
      entry = { session: new LoreSession(id, dep), draft };
      loreReg.set(id, entry);
    }
    const { turnId } = await entry.session.handleMessage(body.text);
    return c.json({ turnId }, 202);
  });

  // 读未 commit 的 Draft 当前态(构建中途产物)。
  // 由来:RT-5 后 lore 是 REST only——POST /lore-sessions/:id/messages 把构建 GM 跑到 turn_end 即收尾,
  // 只返回 {turnId},不回传 GM 散文(不广播/不落 narration)。构建 GM 改的是 LoreSession 持有的 in-memory
  // Draft(经 dicelore_build_* 工具),commit 前 catalog 里查不到。故作者(eval 经 build-mcp,或前端构建台)
  // 要看"这一轮构建 GM 把 Draft 改成了什么"只能读这里。additive GET:不改 messages/commit 等既有端点行为,
  // 仅暴露既有 LoreSession.draft 的只读视图(toPackFiles=将提交的包文件;snapshot=分域结构化回读)。
  // 会话不存在(从未 POST 过 messages)→ 404,与"已存在但 Draft 空"区分。
  app.get("/lore-sessions/:id/draft", (c) => {
    const entry = getLoreEntry(c.req.param("id"));
    if (!entry) return c.json({ error: { code: "NO_SESSION", message: "lore 会话不存在(尚未发过构建指令)" } }, 404);
    return c.json({ files: entry.draft.toPackFiles(), snapshot: entry.draft.snapshot() });
  });

  // 释放构建会话:从 loreReg 删 {session, draft}(每个 Draft 持完整 in-memory 包内容,
  // 不删则常驻内存至进程退出——对比 dice 侧 removeHost + DELETE /sessions/:id 的清理)。
  // 前端构建台离开/提交后应显式调它释放。会话不存在亦幂等返 ok。
  app.delete("/lore-sessions/:id", (c) => {
    loreReg.delete(c.req.param("id"));
    return c.json({ ok: true });
  });

  return app;
}

export function getLoreEntry(id: string): { session: LoreSession; draft: Draft } | undefined { return loreReg.get(id); }

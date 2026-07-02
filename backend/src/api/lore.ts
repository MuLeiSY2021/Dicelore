// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { mkdirSync, createWriteStream, unlinkSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { list, commit, tag, checkout, validatePack, createBuildMcpServer, Draft, type CatalogDB, type PackFile } from "@dicelore/backend";
import { LoreSession, type LoreSessionDeps, type AgentFactory, type PluginRef } from "@dicelore/harness";

export interface LoreDeps {
  catalog: CatalogDB;
  agentFactory: AgentFactory; // CC SDK 适配器挂构建 MCP + 构建 skill
  buildPrompt?: string; // 构建教条(→ openingPrompt)
  plugin?: PluginRef; // 构建 skill plugin(build-pack+build-core,boot 期物化到 $/lore)
  sessionsDir?: string; // sessions 数据根:每 session 工作区落 <sessionsDir>/lore/sessions/<id>/workspace/(build-agent-workspace)
}

// 每 session 持久工作区(build-agent-workspace §1):<sessionsDir>/lore/sessions/<id>/workspace/。
// 仅 mkdir workspace/materials/(**不拷任何 skill、不产 .claude**——skill 经 plugin 从数据根按引用加载)。
// 幂等:重复调不炸。返回 workspace 绝对路径(=构建 agent 的 cwd,经 AgentInit.workspace 透传)。
export function ensureWorkspace(sessionsDir: string, sessionId: string): string {
  const workspace = join(sessionsDir, "lore", "sessions", sessionId, "workspace");
  mkdirSync(join(workspace, "materials"), { recursive: true });
  return workspace;
}

// 净化上传文件名:取 basename(剥路径)、拒空 / 拒仍含分隔符或 ..(basename 后若与原值不一致 = 曾带路径,拒之)。
// 返回净化后的安全文件名,非法返 null。
function sanitizeFilename(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const name = basename(raw);
  if (!name || name === "." || name === ".." || name !== raw) return null;
  return name;
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
      // workspace:sessionsDir 已接线时,首条 message 前确保 workspace 就位并透传给 agentFactory(cwd);
      // 未接线(如纯 catalog 单测)则 workspace 恒 undefined(agent 用 SDK 默认 cwd)。
      const workspace = deps.sessionsDir ? ensureWorkspace(deps.sessionsDir, id) : undefined;
      const dep: LoreSessionDeps = { mcpServer, agentFactory: deps.agentFactory, buildPrompt: deps.buildPrompt, plugin: deps.plugin, workspace };
      entry = { session: new LoreSession(id, dep), draft };
      loreReg.set(id, entry);
    }
    // §1 BE-lore-error-shape:handleMessage 返回 {turnId, error?}——error 属领域级(构建 GM 中途出错),
    // turn 已实际跑完(turnId 有效)→ HTTP 保持 202 不变,靠 body 的 error 字段标失败(不改 5xx)。
    // 调用方(build-mcp / 前端构建台)以 body.error 存在与否判成败。
    const { turnId, error } = await entry.session.handleMessage(body.text);
    return c.json(error ? { turnId, error } : { turnId }, 202);
  });

  // 素材流式上传(build-agent-workspace §3):请求体=原始文件字节流(application/octet-stream),
  // 文件名经 query ?filename= 或 header X-Material-Filename 带(不在 body)。
  // ensureWorkspace → 净化 filename → 边读边写落 workspace/materials/<filename>(同名覆盖),
  // 边写边累计字节;超 DICELORE_MATERIAL_MAX_MB(默认 100)立即 destroy + unlink 半成品 + 413(不吃内存)。
  // error 属领域级但上传是 IO 端点(非构建反馈):filename 非法 400、超限 413、写盘失败 500(均清半成品)。
  app.post("/lore-sessions/:id/materials", async (c) => {
    const id = c.req.param("id");
    if (!deps.sessionsDir) {
      return c.json({ error: { code: "no_workspace", message: "sessionsDir 未接线,素材上传不可用" } }, 500);
    }
    const rawName = c.req.query("filename") ?? c.req.header("x-material-filename");
    const filename = sanitizeFilename(rawName);
    if (!filename) {
      return c.json({ error: { code: "bad_material_name", message: "文件名非法(空 / 含路径分隔符 / ..)" } }, 400);
    }
    const workspace = ensureWorkspace(deps.sessionsDir, id);
    const dest = join(workspace, "materials", filename);
    const maxBytes = (Number(process.env.DICELORE_MATERIAL_MAX_MB) || 100) * 1024 * 1024;

    const web = c.req.raw.body;
    if (!web) {
      return c.json({ error: { code: "empty_body", message: "请求体为空" } }, 400);
    }
    // 流式:边读边写、边累计字节;超限中途掐断 + 清半成品(不整体缓冲整文件、不吃内存)。
    const source = Readable.fromWeb(web as Parameters<typeof Readable.fromWeb>[0]);
    const sink = createWriteStream(dest);
    let bytes = 0;
    let tooLarge = false;
    const cleanup = () => { if (existsSync(dest)) { try { unlinkSync(dest); } catch { /* ignore */ } } };
    try {
      for await (const chunk of source) {
        const buf = chunk as Buffer;
        bytes += buf.length;
        if (bytes > maxBytes) {
          tooLarge = true;
          source.destroy();
          break;
        }
        // 尊重背压:write 返回 false 时等 drain,避免把整流堆进内存。
        if (!sink.write(buf)) {
          await new Promise<void>((res) => sink.once("drain", res));
        }
      }
    } catch (e) {
      sink.destroy();
      cleanup();
      return c.json({ error: { code: "material_write_failed", message: String((e as Error)?.message ?? e) } }, 500);
    }
    if (tooLarge) {
      sink.destroy();
      cleanup();
      return c.json({ error: { code: "material_too_large", message: `素材超过上限 ${maxBytes} 字节` } }, 413);
    }
    // 正常收尾:关闭写流并等 flush。
    try {
      await new Promise<void>((res, rej) => { sink.end((err?: Error | null) => (err ? rej(err) : res())); });
    } catch (e) {
      cleanup();
      return c.json({ error: { code: "material_write_failed", message: String((e as Error)?.message ?? e) } }, 500);
    }
    return c.json({ path: `materials/${filename}`, bytes });
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

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// build-mcp = CC(Claude Code)经此 stdio MCP 连本机后端 dicelore 构建 HTTP,当**作者**+评估者。
// 对称 play-mcp.ts(那条 CC 当玩家);本条 CC 当团本作者,经此驱动真**构建 GM**跑团本构建 eval。
// eval 入口:把后端 lore/catalog 接口包成 MCP 工具。后端 URL=env DICELORE_PLAY_URL(与 play-mcp 共用同名,
// 指向同一 orchestrator 进程的 lore 面)。
//
// ⚠️ 关键设计点(RT-5):lore 构建是 **REST only**。POST /lore-sessions/:id/messages 把构建 GM 驱动到
// turn_end 即收尾、**只返回 {turnId},不回传 GM 散文**(不广播、不落 narration)。构建 GM 改的是后端
// LoreSession 持有的 in-memory Draft(经 dicelore_build_* 工具)。所以 eval 模型不是「作者发指令→收 GM
// 散文」(那是 play 侧 dice GM 的形态),而是「作者发自然语言指令 → 检视产物(未 commit 的 Draft / 已
// commit 的 catalog 文件)判断构建 GM 干了什么、进度如何」。检视类工具因此是本 MCP 的关键能力。
//
// 工具集(对称 play-mcp 的 open/send/get_presentation,按构建语义重命名):
//   驱动类:open_build_session(起会话 id)、send_to_builder(发指令驱动构建 GM 一轮)
//   检视类:get_draft(看未 commit 的 Draft 当前态——靠 GET /lore-sessions/:id/draft,见下注)、
//           list_catalog(看已 commit 的团本目录)、get_pack_files(看某团本某版本的包文件)
// handler 抽纯函数(可测,见 build-mcp.test.ts);main() 起 stdio McpServer。参照 play-mcp.ts 结构。
// 落 eval/(非 src):import @modelcontextprotocol/sdk(orchestrator 未声明,靠 transitive),不进 typecheck,作脚本。
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PLAY_URL = () => process.env.DICELORE_PLAY_URL ?? "http://localhost:8787";

async function jfetch(p: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(`${PLAY_URL()}${p}`, init);
  if (!r.ok) throw new Error(`后端 ${r.status} ${p}: ${await r.text().catch(() => "")}`);
  return r.json();
}
function post(p: string, body: unknown): Promise<unknown> {
  return jfetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
function enc(sid: string): string { return encodeURIComponent(sid); }
function json(v: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(v) }] }; }

// 发一条作者指令驱动构建 GM 一轮。REST only(RT-5):后端把构建 GM 跑到 turn_end 即返回 {turnId},
// 不回传散文。name = 在造的团本名(→ 后端 UUIDv5 身份;同名 session 累积到同一 Draft)。
// 作者拿到 {turnId} 后,靠 get_draft / list_catalog 检视构建 GM 这一轮改了什么。
export async function doSendToBuilder(sid: string, name: string, text: string): Promise<{ turnId: string }> {
  return (await post(`/lore-sessions/${enc(sid)}/messages`, { text, name })) as { turnId: string };
}
// 起一个构建会话 id。后端 LoreSession 是 getOrCreate(首次 POST messages 时建),故这里只回 sid 不打后端——
// 与 play-mcp.doOpenSession 灌种子建 session 的语义不同(构建会话无场景种子,空 Draft 起步)。
// sid 由作者自定(默认随机),首次 send_to_builder 时后端按此 id 建 LoreSession。
export function doOpenBuildSession(sessionId?: string): string {
  return sessionId ?? `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
// 检视:看未 commit 的 Draft 当前态(构建中途产物)。返回 { files(将提交的包文件), snapshot(分域结构化) }。
// 这是判断「构建 GM 干了什么 / 进度」的主检视面——因构建 GM 响应不经 REST 返回。
export const doGetDraft = (sid: string) => jfetch(`/lore-sessions/${enc(sid)}/draft`);
// 检视:已 commit 的团本目录(列所有团本 + 版本概要)。看哪些团本/版本已落 catalog。
export const doListCatalog = () => jfetch(`/catalog`);
// 检视:某团本某版本的全部包文件。ref 缺省=head(最新 commit)。看已 commit 团本的实际文件内容。
export const doGetPackFiles = (tuanbenId: string, ref?: string) =>
  jfetch(`/catalog/${enc(tuanbenId)}/files${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);

async function main() {
  const server = new McpServer({ name: "dicelore-build", version: "0.1.0" });
  const ro = { readOnlyHint: true } as const;
  const rw = { readOnlyHint: false } as const;
  server.tool("open_build_session", "起一个构建会话 id(作者经此 id 驱动构建 GM 造团本;不带参则随机生成)", { sessionId: z.string().optional() }, async ({ sessionId }) => json(doOpenBuildSession(sessionId)), rw);
  server.tool("send_to_builder", "作者自然语言指令驱动构建 GM 一轮(改 in-memory Draft)。REST only:只返回 {turnId},不回传 GM 散文——靠 get_draft/list_catalog 检视产物。name=在造团本名。", { sessionId: z.string(), name: z.string(), text: z.string() }, async ({ sessionId, name, text }) => json(await doSendToBuilder(sessionId, name, text)), rw);
  server.tool("get_draft", "检视未 commit 的 Draft 当前态(构建中途产物):{ files(将提交的包文件), snapshot(分域结构化回读) }。判断构建 GM 干了什么/进度的主检视面。", { sessionId: z.string() }, async ({ sessionId }) => json(await doGetDraft(sessionId)), ro);
  server.tool("list_catalog", "检视已 commit 的团本目录(列所有团本 + 版本概要)", {}, async () => json(await doListCatalog()), ro);
  server.tool("get_pack_files", "检视某团本某版本的全部包文件(ref 缺省=head 最新 commit)", { tuanbenId: z.string(), ref: z.string().optional() }, async ({ tuanbenId, ref }) => json(await doGetPackFiles(tuanbenId, ref)), ro);
  await server.connect(new StdioServerTransport());
}

const invokedDirect = process.argv[1]?.endsWith("build-mcp.ts");
if (invokedDirect) await main();

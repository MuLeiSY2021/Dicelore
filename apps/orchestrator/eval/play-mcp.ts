// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// play-mcp = CC(Claude Code)经此 stdio MCP 连本机后端 dicelore play HTTP,当玩家+评估者。
// eval 入口(D1):包后端 play 接口为 MCP 工具。后端 URL=env DICELORE_PLAY_URL;sessions_dir=env DICELORE_SESSIONS_DIR。
// 关键:narration 只经 WS 流式(streamDriverTurn 不落库),故 send_message/start_game 工具内连 WS
// 收 narration_commit→turn_ended,返回 GM 散文;get_presentation 取机械态快照(sheets/mechanics/choices/ended)。
// 工具 handler 抽纯函数(可测,见 play-mcp.test.ts);main() 起 stdio McpServer。参照 packages/core/src/mcp/server.ts。
// 落 eval/(非 src):import @modelcontextprotocol/sdk(orchestrator 未声明,靠 transitive),不进 typecheck,作脚本。
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { prepareSessionDb } from "@dicelore/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
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

// 灌场景种子到后端 sessions_dir,返回 sessionId(=sessionName)。后端 getOrCreateHost 读同一 db。
export async function doOpenSession(scenarioId: string): Promise<string> {
  const sessionsDir = process.env.DICELORE_SESSIONS_DIR ?? "."; // 与后端 server.ts 默认一致,避免 mkdtemp 新目录
  const { sessionName } = await prepareSessionDb(scenarioId, { sessionsDir });
  return sessionName;
}
export const doListScenarios = async (): Promise<string[]> => {
  const dir = join(here, "..", "..", "..", "packages", "core", "eval", "scenarios"); // eval/ → 3级.. → packages/core/eval/scenarios
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
};

// 驱动一回合经 WS 收 GM 散文:narration 只流式(不落库),故开 WS → POST 触发回合 → 收 narration_commit
// 到 turn_ended → 返回 narrations。POST /messages 与 /start 都同步等回合跑完(turnLoop 发 turn_ended 后 return)。
export async function doTurn(sid: string, postPath: string, body: unknown): Promise<{ narrations: string[]; turnEnded: boolean }> {
  const wsUrl = PLAY_URL().replace(/^http/, "ws") + `/sessions/${enc(sid)}/ws`;
  const ws = new WebSocket(wsUrl);
  const narrations: string[] = [];
  let turnEnded = false;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { try { ws.close(); } catch { /* ignore */ } };
    ws.on("open", () => { post(postPath, body).catch((e) => { cleanup(); reject(e); }); });
    ws.on("message", (d) => {
      let m: { type?: string; text?: string; message?: string }; try { m = JSON.parse(d.toString()); } catch { return; }
      if (m.type === "narration_commit" && typeof m.text === "string") narrations.push(m.text);
      else if (m.type === "turn_ended") { turnEnded = true; cleanup(); resolve(); }
      else if (m.type === "error") { cleanup(); reject(new Error(m.message ?? "gm error")); }
    });
    ws.on("error", (e) => { cleanup(); reject(e); });
  });
  return { narrations, turnEnded };
}
export const doStartGame = (sid: string) => doTurn(sid, `/sessions/${enc(sid)}/start`, {});
export const doSendMessage = (sid: string, text: string) => doTurn(sid, `/sessions/${enc(sid)}/messages`, { text });
export const doGetPresentation = (sid: string) => jfetch(`/sessions/${enc(sid)}/presentation`);
export const doChoose = (sid: string, eventId: number, optionIndex: number) => post(`/sessions/${enc(sid)}/choices`, { eventId, optionIndex });
export const doRoll = (sid: string, eventId: number) => post(`/sessions/${enc(sid)}/roll`, { eventId });
export const doBrowse = (sid: string, source: string, q: string) =>
  jfetch(`/sessions/${enc(sid)}/browse?source=${encodeURIComponent(source)}&q=${encodeURIComponent(q)}`);

async function main() {
  const server = new McpServer({ name: "dicelore-play", version: "0.1.0" });
  const ro = { readOnlyHint: true } as const;
  const rw = { readOnlyHint: false } as const;
  server.tool("list_scenarios", "列出可用 eval 场景", {}, async () => json(await doListScenarios()), ro);
  server.tool("open_session", "灌场景种子建后端 session,返回 sessionId", { scenarioId: z.string() }, async ({ scenarioId }) => json(await doOpenSession(scenarioId)), rw);
  server.tool("start_game", "开始游戏(开场回合),返回 GM 散文", { sessionId: z.string() }, async ({ sessionId }) => json(await doStartGame(sessionId)), rw);
  server.tool("send_message", "玩家发言驱动 GM 一回合,返回 GM 散文(narrations)+turnEnded", { sessionId: z.string(), text: z.string() }, async ({ sessionId, text }) => json(await doSendMessage(sessionId, text)), rw);
  server.tool("get_presentation", "取机械态快照(sheets/mechanics/choices/pendingRoll/seq)", { sessionId: z.string() }, async ({ sessionId }) => json(await doGetPresentation(sessionId)), ro);
  server.tool("choose", "选选项", { sessionId: z.string(), eventId: z.number(), optionIndex: z.number() }, async ({ sessionId, eventId, optionIndex }) => json(await doChoose(sessionId, eventId, optionIndex)), rw);
  server.tool("roll", "掷骰(resolve pending roll)", { sessionId: z.string(), eventId: z.number() }, async ({ sessionId, eventId }) => json(await doRoll(sessionId, eventId)), rw);
  server.tool("browse", "浏览 world/rule/log", { sessionId: z.string(), source: z.string(), q: z.string() }, async ({ sessionId, source, q }) => json(await doBrowse(sessionId, source, q)), ro);
  await server.connect(new StdioServerTransport());
}

const invokedDirect = process.argv[1]?.endsWith("play-mcp.ts");
if (invokedDirect) await main();

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PresentationSnapshot, SessionSummary } from "@dicelore/shared";

// 只读：取全量呈现快照(接口页 §2 GET /sessions/:id/presentation)。增量 WS 仍阻塞。
export async function getPresentation(sessionId: string): Promise<PresentationSnapshot> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/presentation`);
  if (!res.ok) throw new Error(`presentation 请求失败：${res.status}`);
  return (await res.json()) as PresentationSnapshot;
}

// 会话列表(主页继续上次 / 最近 Session)。
export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/sessions");
  if (!res.ok) throw new Error(`sessions 请求失败：${res.status}`);
  return ((await res.json()) as { sessions: SessionSummary[] }).sessions;
}

// 动作进：玩家自由文本输入(接口页 §2 POST /sessions/:id/messages)。
export async function postMessage(sessionId: string, text: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`message 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// 明骰：玩家点击触发掷骰(POST /sessions/:id/roll)。
export async function postRoll(sessionId: string, eventId: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/roll`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }),
  });
  if (!res.ok) throw new Error(`roll 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// ===== 团本目录录(后端双路径架构 P2/P3/P5)=====
export interface TuanbenSummary { id: string; name: string; head: string | null; tags: string[] }
export interface PackFile { path: string; content: string }

// 列团本(主页选团本玩 / 构建台列表)。
export async function listCatalog(): Promise<TuanbenSummary[]> {
  const res = await fetch("/catalog");
  if (!res.ok) throw new Error(`catalog 请求失败：${res.status}`);
  return ((await res.json()) as { tuanben: TuanbenSummary[] }).tuanben;
}

// 直接提交一个团本版本(程序化建包)。
export async function commitPack(name: string, message: string, files: PackFile[]): Promise<{ tuanbenId: string; commitId: string }> {
  const res = await fetch("/catalog/commit", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, message, files }),
  });
  if (!res.ok) throw new Error(`commit 请求失败：${res.status}`);
  return (await res.json()) as { tuanbenId: string; commitId: string };
}

// 开新局:选团本版本 import → 运行库(POST /sessions/:id/open)。
export async function openPlaySession(sessionId: string, tuanbenId: string, ref: string): Promise<void> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/open`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tuanbenId, ref }),
  });
  if (!res.ok) throw new Error(`open 请求失败：${res.status}`);
}

// 读团本版本全部包文件(团本制作页中央渲染)。
export async function getCatalogFiles(tuanbenId: string, ref = "head"): Promise<PackFile[]> {
  const res = await fetch(`/catalog/${encodeURIComponent(tuanbenId)}/files?ref=${encodeURIComponent(ref)}`);
  if (!res.ok) throw new Error(`files 请求失败：${res.status}`);
  return ((await res.json()) as { files: PackFile[] }).files;
}

// 整包校验(团本制作页校验报告)。
export interface ValidateIssue { level: "error" | "warn"; path: string; msg: string }
export async function validateCatalog(files: PackFile[]): Promise<{ ok: boolean; issues: ValidateIssue[] }> {
  const res = await fetch("/catalog/validate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(`validate 请求失败：${res.status}`);
  return (await res.json()) as { ok: boolean; issues: ValidateIssue[] };
}

// 发布 tag。
export async function tagPack(tuanbenId: string, commitId: string, label: string): Promise<void> {
  const res = await fetch(`/catalog/${encodeURIComponent(tuanbenId)}/tag`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commitId, label }),
  });
  if (!res.ok) throw new Error(`tag 请求失败：${res.status}`);
}

// 构建助手对话(POST /lore-sessions/:id/messages)。
export async function postBuildMessage(loreSessionId: string, text: string, name: string): Promise<{ turnId: string }> {
  const res = await fetch(`/lore-sessions/${encodeURIComponent(loreSessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, name }),
  });
  if (!res.ok) throw new Error(`build message 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// 选项点选：玩家点 choice 作下一回合输入(POST /sessions/:id/choices)。接口页 §9.3 gap② 闭环。
export async function postChoice(sessionId: string, eventId: number, optionIndex: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/choices`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, optionIndex }),
  });
  if (!res.ok) throw new Error(`choice 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// 左活动轨自查源浏览(GET /sessions/:id/browse)。
export type BrowseSource = "world" | "rule" | "log";
export interface BrowseEntry { name: string; tag: string | null; snippet: string; canPin: boolean; ref: string }
export async function browse(sessionId: string, source: BrowseSource, q = ""): Promise<BrowseEntry[]> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/browse?source=${source}&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`browse 请求失败：${res.status}`);
  return ((await res.json()) as { entries: BrowseEntry[] }).entries;
}

// ===== 诊断/自检(缝B 真值；配置页 + 顶栏运行态) =====
export interface HealthInfo {
  protocol: string; fakeGm: boolean; port: number;
  model: { gm: string; configured: boolean; baseUrl: string | null };
  mcp: { name: string; transport: string; toolCount: number; running: boolean };
  notify: { url: string | null; configured: boolean };
  storage: { sessionsDir: string; ftsMode: string };
}
export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch("/diagnostics/health");
  if (!res.ok) throw new Error(`health 请求失败：${res.status}`);
  return (await res.json()) as HealthInfo;
}
export interface TestResult { ok: boolean; status?: number; latencyMs?: number; message: string; fake?: boolean }
export async function testModel(input: { baseUrl: string; key: string; gm: string }): Promise<TestResult> {
  const res = await fetch("/diagnostics/model-test", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  return (await res.json()) as TestResult;
}
export async function testMcp(input: { transport: string; endpoint: string }): Promise<TestResult> {
  const res = await fetch("/diagnostics/mcp-test", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  return (await res.json()) as TestResult;
}

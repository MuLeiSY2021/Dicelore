// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// Play 域 HTTP：游玩会话(presentation/messages/roll/choice/rewind/start/browse/list/delete)。

import type {
  PresentationSnapshot, SessionSummary, SessionConfig, SessionConfigUpdate,
  BranchListResponse, CreateBranchResponse,
} from "@dicelore/shared";
import { actionError } from "@/shared/api/http.js";

// 只读：取全量呈现快照(接口页 §2 GET /sessions/:id/presentation)。增量 WS 仍阻塞。
export async function getPresentation(sessionId: string): Promise<PresentationSnapshot> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/presentation`);
  if (!res.ok) throw new Error(`presentation 请求失败：${res.status}`);
  return (await res.json()) as PresentationSnapshot;
}

// 会话列表(主页继续上次 / 最近 Session)。
export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/sessions/dicegm");
  if (!res.ok) throw new Error(`sessions 请求失败：${res.status}`);
  return ((await res.json()) as { sessions: SessionSummary[] }).sessions;
}

// 会话元信息(GET /sessions/dicegm/:id → {status:active|debrief, ended, title})。
// 用于让「终局=复盘态」从会话状态派生（重连/回填后仍在），而非仅瞬时 WS game_end 帧。
export interface SessionMeta { sessionId: string; kind: string; status: "active" | "debrief" | "archived"; ended: boolean; title: string }
export async function getSessionMeta(sessionId: string): Promise<SessionMeta> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`session meta 请求失败：${res.status}`);
  return (await res.json()) as SessionMeta;
}

// 动作进：玩家自由文本输入(接口页 §2 POST /sessions/:id/messages)。
export async function postMessage(sessionId: string, text: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await actionError(res, "发送消息");
  return (await res.json()) as { turnId: string };
}

// 明骰：玩家点击触发掷骰(POST /sessions/:id/roll)。
export async function postRoll(sessionId: string, eventId: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/roll`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }),
  });
  if (!res.ok) throw await actionError(res, "掷骰");
  return (await res.json()) as { turnId: string };
}

// 读档（SNAP-1 / ADR-0017 v1）：自动恢复最近一份快照（POST /sessions/:id/rewind）。
// v1 是「存档/读档」语义——回合末后端自动存档，此处一键读回最近存档；非手动回滚按钮/branch（v2）。
// 409 no_snapshot = 本局还没存档（未跑过一个完整回合），给玩家可读提示。
export async function postRewind(sessionId: string): Promise<{ snapshotId: number }> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/rewind`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
  });
  if (!res.ok) throw await actionError(res, "读档");
  return (await res.json()) as { snapshotId: number };
}

// kickoff：触发 GM 开场回合(prologue 驱动，无玩家输入)。后端契约 POST /sessions/:id/start。
// 优雅降级：后端未上线 /start(404)时回退到 POST /messages 喂开场 cue，使当前后端也能开场。
export async function startGame(sessionId: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/start`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
  });
  if (res.ok) return (await res.json()) as { turnId: string };
  if (res.status === 404) return postMessage(sessionId, "（开始游戏）"); // 回退
  throw new Error(`start 请求失败：${res.status}`);
}

// 删除会话(DELETE /sessions/:id)。后端未上线时静默成功(前端本地移除)。
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`delete 请求失败：${res.status}`);
  } catch { /* 后端未上线 DELETE：前端本地移除即可 */ }
}

// 选项点选：玩家点 choice 作下一回合输入(POST /sessions/:id/choices)。接口页 §9.3 gap② 闭环。
export async function postChoice(sessionId: string, eventId: number, optionIndex: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/choices`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, optionIndex }),
  });
  if (!res.ok) throw await actionError(res, "提交选择");
  return (await res.json()) as { turnId: string };
}

// 事件回填(GET /sessions/:id/events)：默认全量含 visible=0（spoiler-tiering §一.2）。
// 用于让暗骰(kind=verdict·visible=0)缩略指示从事件历史渲染、重连/回填后仍在（非仅瞬时 WS 帧）。
export interface LogEvent { seq: number; kind: string; text?: string; data?: unknown; visible: number }
export async function getEvents(sessionId: string, since = 0): Promise<LogEvent[]> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/events?since=${since}`);
  if (!res.ok) throw new Error(`events 请求失败：${res.status}`);
  return ((await res.json()) as { events: LogEvent[] }).events;
}

// 左活动轨自查源浏览(GET /sessions/:id/browse)。
export type BrowseSource = "world" | "rule" | "log";
export interface BrowseEntry { name: string; tag: string | null; snippet: string; canPin: boolean; ref: string }
export async function browse(sessionId: string, source: BrowseSource, q = ""): Promise<BrowseEntry[]> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/browse?source=${source}&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`browse 请求失败：${res.status}`);
  return ((await res.json()) as { entries: BrowseEntry[] }).entries;
}

// 统一 session config（model-switch + spoiler-tiering 裁决）：读回 {model, spoilerTier, pendingModel?}。
export async function getConfig(sessionId: string): Promise<SessionConfig> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/config`);
  if (!res.ok) throw new Error(`config 请求失败：${res.status}`);
  return (await res.json()) as SessionConfig;
}

// 部分更新 config：{model?} 下回合生效 / {spoilerTier?} 立即生效。返回更新后完整 config。
export async function postConfig(sessionId: string, update: SessionConfigUpdate): Promise<SessionConfig> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/config`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(update),
  });
  if (!res.ok) throw await actionError(res, "更新配置");
  return (await res.json()) as SessionConfig;
}

// 用量报告（usage-and-context 裁决）：context 占用 + session 累计 + perTurn + mcp/memory 分项。
export interface MemorySegment { segment: string; tokens: number }
export interface McpToolUsage { tool: string; calls: number; tokens: number }
export interface PerTurnRow { turnId: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number }
export interface UsageReport {
  model: string;
  contextTokens: number;
  contextWindow: number;
  contextPct: number;
  sessionTotal: number;
  perTurn: PerTurnRow[];
  memoryBreakdown?: MemorySegment[];
  mcpBreakdown?: McpToolUsage[];
}
export async function getUsage(sessionId: string): Promise<UsageReport> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/usage`);
  if (!res.ok) throw new Error(`usage 请求失败：${res.status}`);
  return (await res.json()) as UsageReport;
}

// 会话分支（debrief-and-branch §二）：列分支 / 从某 seq 新建分支（复盘态回档）。
export async function listBranches(sessionId: string): Promise<BranchListResponse> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/branches`);
  if (!res.ok) throw new Error(`branches 请求失败：${res.status}`);
  return (await res.json()) as BranchListResponse;
}
export async function createBranch(sessionId: string, fromSeq?: number, name?: string): Promise<CreateBranchResponse> {
  const res = await fetch(`/sessions/dicegm/${encodeURIComponent(sessionId)}/branches`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(fromSeq != null ? { fromSeq } : {}), ...(name ? { name } : {}) }),
  });
  if (!res.ok) throw await actionError(res, "新建分支");
  return (await res.json()) as CreateBranchResponse;
}

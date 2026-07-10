// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 构建域 HTTP（loregm 会话拉平后的 /sessions/loregm/*）：
//   显式建会话 · 构建助手对话（含 per-turn usage）· 读 Draft · 活跃期校验 · 会话列 · 素材流式上传 · 释放会话。

import { apiError } from "@/shared/api/http.js";
import type { PackFile, ValidateIssue } from "@/features/catalog/api.js";
import type { TokenUsage } from "@/features/cost/pricing.js";

// ── Draft 分域快照（对齐后端 Draft.snapshot()，GET /sessions/loregm/:id/draft）──
// 各域是「即写即读」回读态；前端 data-view 直接消费（不再靠 parsePack 从文件树反推）。
export interface FrontSpec {
  id: string; title?: string; clockName?: string; clockMax?: number;
  steps?: { at: number; text: string }[];
}
export interface StateCell { entity: string; kind?: string; attr: string; value: string | number; visible?: number }
export interface DraftSnapshot {
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
}
export interface DraftView { files: PackFile[]; snapshot: DraftSnapshot }

// 构建会话摘要（GET /sessions/loregm，session-surface-flatten §四 / RT-FE13）。
export interface LoreSessionSummary {
  sessionId: string;
  kind: string;
  status: "active" | "archived";
  title: string;
  packName: string;
  lastActionAt?: number;
  lastaction?: string;
}

// 本轮 usage（loregm messages 响应内联，usage-stream §3 / RT-FE16 co-build）。
export type BuildTurnUsage = TokenUsage;
export interface BuildMessageResult { turnId: string; usage?: BuildTurnUsage; error?: { code: string; message: string } }

// 显式建构建会话(session-surface-flatten §三)：POST /sessions/loregm {name?} → 201 {sessionId, kind}。
// 服务端生成 sessionId、建 Draft + 构建 MCP。取代首访懒建(C2 移除)。返回 sessionId 供后续 message/draft。
export async function createLoreSession(name?: string): Promise<string> {
  const res = await fetch("/sessions/loregm", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(name === undefined ? {} : { name }),
  });
  if (!res.ok) throw await apiError(res, "create lore session");
  return ((await res.json()) as { sessionId: string }).sessionId;
}

// 构建助手对话(POST /sessions/loregm/:id/messages)。会话须先经 createLoreSession 显式建。
// 响应体内联本轮 usage(usage-stream §3，success 轮带)与领域级 error(构建 GM 中途出错，turn 仍已跑完)。
export async function postBuildMessage(loreSessionId: string, text: string): Promise<BuildMessageResult> {
  const res = await fetch(`/sessions/loregm/${encodeURIComponent(loreSessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await apiError(res, "build message");
  return (await res.json()) as BuildMessageResult;
}

// 读未 commit 的 Draft 当前态(GET /sessions/loregm/:id/draft)：{files(将提交的包), snapshot(分域回读)}。
// 即写即读刷新的数据源(WS draft_delta 触发后重拉)。
export async function getDraft(loreSessionId: string): Promise<DraftView> {
  const res = await fetch(`/sessions/loregm/${encodeURIComponent(loreSessionId)}/draft`);
  if (!res.ok) throw await apiError(res, "get draft");
  return (await res.json()) as DraftView;
}

// 活跃期 Draft 校验(RT-FE11 §二)：POST /sessions/loregm/:id/draft/validate。
// 无 body、只读、幂等；返 {issues:[{level,path,msg}]}，path 用 Draft 分域路径(world.lore.x / manifest.meta…)。
export async function validateDraft(loreSessionId: string): Promise<ValidateIssue[]> {
  const res = await fetch(`/sessions/loregm/${encodeURIComponent(loreSessionId)}/draft/validate`, { method: "POST" });
  if (!res.ok) throw await apiError(res, "validate draft");
  return ((await res.json()) as { issues: ValidateIssue[] }).issues;
}

// 构建会话列表(GET /sessions/loregm)：bay session 弹窗列活跃/已归档会话 + 最新动作。
export async function listLoreSessions(): Promise<LoreSessionSummary[]> {
  const res = await fetch("/sessions/loregm");
  if (!res.ok) throw await apiError(res, "list lore sessions");
  return ((await res.json()) as { sessions: LoreSessionSummary[] }).sessions ?? [];
}

// 释放构建会话(DELETE /sessions/loregm/:id)：离开/提交后显式释放 in-memory Draft。幂等。
export async function deleteLoreSession(loreSessionId: string): Promise<void> {
  const res = await fetch(`/sessions/loregm/${encodeURIComponent(loreSessionId)}`, { method: "DELETE" });
  if (!res.ok) throw await apiError(res, "delete lore session");
}

// 素材流式上传(POST /sessions/loregm/:id/materials)：请求体=原始文件字节流，文件名经 ?filename= 带。
// 用 XMLHttpRequest 以拿 upload.onprogress(fetch 无上传进度事件)；大源不经 LLM 中继、边读边写落盘。
export function uploadMaterial(
  loreSessionId: string, file: File, onProgress?: (pct: number) => void,
): { promise: Promise<{ path: string; bytes: number }>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ path: string; bytes: number }>((resolve, reject) => {
    const url = `/sessions/loregm/${encodeURIComponent(loreSessionId)}/materials?filename=${encodeURIComponent(file.name)}`;
    xhr.open("POST", url);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as { path: string; bytes: number }); }
        catch { reject(new Error("素材上传响应解析失败")); }
      } else {
        let msg = String(xhr.status);
        try { msg = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("素材上传网络错误"));
    xhr.onabort = () => reject(new Error("素材上传已取消"));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 团本目录域 HTTP(后端双路径架构 P2/P3/P5)：列团本 / 建包 / 取文件 / 校验 / 发布 tag / 开新局。

import { apiError } from "@/shared/api/http.js";

export interface AdventureSummary { id: string; name: string; head: string | null; tags: string[] }
export interface PackFile { path: string; content: string }

// 列团本(主页选团本玩 / 构建台列表)。
export async function listCatalog(): Promise<AdventureSummary[]> {
  const res = await fetch("/catalog");
  if (!res.ok) throw new Error(`catalog 请求失败：${res.status}`);
  return ((await res.json()) as { adventure: AdventureSummary[] }).adventure;
}

// 直接提交一个团本版本(程序化建包)。
export async function commitPack(name: string, message: string, files: PackFile[]): Promise<{ adventureId: string; commitId: string }> {
  const res = await fetch("/catalog/commit", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, message, files }),
  });
  if (!res.ok) throw await apiError(res, "commit");
  return (await res.json()) as { adventureId: string; commitId: string };
}

// 开新局:选团本版本 import → 运行库(POST /sessions/:id/open)。
export async function openPlaySession(sessionId: string, adventureId: string, ref: string): Promise<void> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/open`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adventureId, ref }),
  });
  if (!res.ok) throw await apiError(res, "open");
}

// 读团本版本全部包文件(团本制作页中央渲染)。
export async function getCatalogFiles(adventureId: string, ref = "head"): Promise<PackFile[]> {
  const res = await fetch(`/catalog/${encodeURIComponent(adventureId)}/files?ref=${encodeURIComponent(ref)}`);
  if (!res.ok) throw new Error(`files 请求失败：${res.status}`);
  return ((await res.json()) as { files: PackFile[] }).files;
}

// 整包校验(团本制作页校验报告)。
export interface ValidateIssue { level: "error" | "warn"; path: string; msg: string }
export async function validateCatalog(files: PackFile[]): Promise<{ ok: boolean; issues: ValidateIssue[] }> {
  const res = await fetch("/catalog/validate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }),
  });
  if (!res.ok) throw await apiError(res, "validate");
  return (await res.json()) as { ok: boolean; issues: ValidateIssue[] };
}

// 发布 tag。
export async function tagPack(adventureId: string, commitId: string, label: string): Promise<void> {
  const res = await fetch(`/catalog/${encodeURIComponent(adventureId)}/tag`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commitId, label }),
  });
  if (!res.ok) throw await apiError(res, "tag");
}

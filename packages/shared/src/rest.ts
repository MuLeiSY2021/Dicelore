// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";

// 会话 kind：HTTP 表皮对称面 /sessions/{kind}（session-surface-flatten）。
// 注意与后端 on-disk harness kind（"dice"|"lore"）区分——那是数据布局，此处是对外 HTTP 词。
export const SessionKindSchema = z.enum(["dicegm", "loregm"]);

// 会话状态（会话列表/元信息共用）。
// debrief=战后复盘态（debrief-and-branch §一）：GM 调 game_end 后会话转此态、不直接归档，
// AI 走复盘行为（harness debrief-mode skill 软约束）。ended 保留作向后兼容旧读值。
export const SessionStatusSchema = z.enum(["active", "archived", "ended", "debrief"]);

export const MessageRequestSchema = z.object({ text: z.string() });
export const MessageResponseSchema = z.object({ turnId: z.string() });
export const ChoiceRequestSchema = z.object({ eventId: z.number(), optionIndex: z.number() });
export const ChoiceResponseSchema = z.object({ turnId: z.string() });
// 显式建会话请求（POST /sessions/{kind}）——两 kind 共用一个 schema，按 kind 取相关字段：
//   · dicegm：{ teamId, version? }（version 省略 = 默认最新版 → validatePack 信任闸）
//   · loregm：{ name? }（团本工作名）
//   · resume：gm-session-continuity 续命（由该节点消费；本节点仅保留 wire 位、不实现）。
export const CreateSessionRequestSchema = z.object({
  teamId: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  resume: z.string().optional(),
});
// 显式建会话响应：201 { sessionId, kind }。
export const CreateSessionResponseSchema = z.object({ sessionId: z.string(), kind: SessionKindSchema });
// GET /sessions/{kind}/:id 元信息（dice.ts/lore.ts 直接构造对象、不经 Schema parse；
// 故只 type 在用、Schema 暂未接线为校验器，保留作 wire 契约单源）。对称形状含 kind + status。
export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  kind: SessionKindSchema,
  status: SessionStatusSchema,
  ended: z.boolean(),
  title: z.string(),
});
// GET /sessions/{kind}/:id/events 的 wire 契约（dice.ts 端点；当前 body 内联构造、未经 Schema parse）。
export const EventRowSchema = z.object({
  seq: z.number(),
  kind: z.string(),
  text: z.string(),
  data: z.unknown().optional(),
});
export const EventsResponseSchema = z.object({ events: z.array(EventRowSchema) });

// 会话摘要（两 kind 共用统一形状，session-surface-flatten §6）：
//   packName 不可空（C3）；lastActionAt（原 updatedAt）/lastReply（最新回复·RT9）/
//   lastaction（最新动作·RT-FE13）供 bay session 呈现，按 kind 有意义则填。
export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  kind: SessionKindSchema,
  status: SessionStatusSchema,
  title: z.string(),
  packName: z.string(), // C3：必填、不可空（无团本名则以 sessionId 兜底）
  started: z.boolean().optional(), // 是否已开场（dicegm kickoff / loregm 无意义则省）
  lastActionAt: z.number().optional(), // epoch ms；无则省略
  lastReply: z.string().optional(), // 最新回复
  lastaction: z.string().optional(), // 最新动作
});
export const SessionsListResponseSchema = z.object({ sessions: z.array(SessionSummarySchema) });

// 明骰：玩家点击触发掷骰（仿 POST /choices）
export const RollRequestSchema = z.object({ eventId: z.number() });
export const RollResponseSchema = z.object({ turnId: z.string() });

// rewind（覆盖当前分支，debrief-and-branch §二.4）：POST /sessions/dicegm/:id/rewind。
//   · {toSeq} → 在当前分支截断到该 seq（其后事件丢弃、领域态复位到最近 ≤toSeq 的快照）；
//   · {toUuid} → 按 transcript 节点回退（TR3）；· 皆省略 → 撤上一轮（最近快照）。
export const RewindRequestSchema = z.object({
  toSeq: z.number().optional(),
  toUuid: z.string().optional(),
});

// 会话分支（debrief-and-branch §二）：一个 dicegm session 下多个 branch，每 branch 一份独立事件日志/快照。
//   · 默认分支 main；当前分支承接 messages/rewind/roll/choices；新建分支自动成当前分支。
export const BranchInfoSchema = z.object({
  branchId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  seq: z.number(), // 该分支当前最大 log seq
  isCurrent: z.boolean(),
});
export const BranchListResponseSchema = z.object({
  currentBranchId: z.string(),
  branches: z.array(BranchInfoSchema),
});
// 新建分支请求：fromSeq 省略=复制当前分支到当前 seq；指定=复制到该 seq（不改原分支）。name 可选。
export const CreateBranchRequestSchema = z.object({
  fromSeq: z.number().optional(),
  name: z.string().optional(),
});
export const CreateBranchResponseSchema = z.object({
  branchId: z.string(),
  sessionId: z.string(),
  fromSeq: z.number(),
  isCurrent: z.literal(true),
});
// checkout 切当前分支 + 返回该分支 presentation 快照（presentation 形状见 presentation.ts；此处 unknown 占位避免循环依赖）。
export const CheckoutResponseSchema = z.object({
  branchId: z.string(),
  presentation: z.unknown(),
});

export type SessionKind = z.infer<typeof SessionKindSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type MessageRequest = z.infer<typeof MessageRequestSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ChoiceRequest = z.infer<typeof ChoiceRequestSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type EventRow = z.infer<typeof EventRowSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>;
export type RollRequest = z.infer<typeof RollRequestSchema>;
export type RollResponse = z.infer<typeof RollResponseSchema>;
export type RewindRequest = z.infer<typeof RewindRequestSchema>;
export type BranchInfo = z.infer<typeof BranchInfoSchema>;
export type BranchListResponse = z.infer<typeof BranchListResponseSchema>;
export type CreateBranchRequest = z.infer<typeof CreateBranchRequestSchema>;
export type CreateBranchResponse = z.infer<typeof CreateBranchResponseSchema>;
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

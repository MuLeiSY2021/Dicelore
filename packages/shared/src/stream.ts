// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";
import { CLIENT_PROTOCOL } from "./protocol.js";
import { ChoicesViewSchema, PendingRollSchema, PresentationDeltaSchema } from "./presentation.js";

const base = { protocol: z.literal(CLIENT_PROTOCOL) };

export const StreamMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("turn_started"), turnId: z.string() }),
  z.object({ ...base, type: z.literal("narration_delta"), turnId: z.string(), text: z.string() }),
  z.object({ ...base, type: z.literal("narration_commit"), seq: z.number(), text: z.string() }),
  z.object({ ...base, type: z.literal("presentation_delta"), delta: PresentationDeltaSchema }),
  z.object({ ...base, type: z.literal("choices"), choices: ChoicesViewSchema }),
  z.object({ ...base, type: z.literal("roll_staged"), pendingRoll: PendingRollSchema }),
  z.object({
    ...base, type: z.literal("roll_committed"),
    eventId: z.number(), rolls: z.array(z.number()), total: z.number(),
    dc: z.number().optional(), outcome: z.string(),
  }),
  // 暗骰(RT-FE6)：GM 主动掷、结果对玩家隐(event visible=0),不走 pendingRoll、不发 roll_staged/committed。
  // 通知带完整结果(result/dc/band),前端按 spoiler 档决定渲染多少(严格档只显 label、关闭档显全)。
  z.object({
    ...base, type: z.literal("hidden_roll"),
    eventId: z.number(), label: z.string(), result: z.number(),
    dc: z.number().optional(),
    band: z.object({ label: z.string(), consequence: z.string() }).optional(),
  }),
  z.object({
    ...base, type: z.literal("turn_ended"), turnId: z.string(), seq: z.number(),
    usage: z.object({
      inputTokens: z.number(), outputTokens: z.number(),
      cacheReadTokens: z.number(), cacheCreationTokens: z.number(),
    }).optional(),
  }),
  z.object({ ...base, type: z.literal("game_end"), reason: z.string(), outcome: z.string() }),
  z.object({ ...base, type: z.literal("error"), code: z.string(), message: z.string() }),
  // 第 11 类（裁决 usage-and-context §四/§5 catalog）：上下文压缩进行态广播。
  // harness 订阅 SDK 流：SDKStatusMessage.status==='compacting' → {phase:"start"}；
  // compact_result==='success'|'failed'（或 SDKCompactBoundaryMessage）→ {phase:"done", result, error?}。
  // 前端据此显/隐「正在进行上下文压缩」提示 + indeterminate 进度条；SDK 压缩不暴露数值进度，故无 progress 字段。
  z.object({
    ...base, type: z.literal("context_compacting"),
    phase: z.enum(["start", "done"]),
    result: z.enum(["success", "failed"]).optional(), // 仅 done 时带
    error: z.string().optional(),                     // 仅 failed 时带（SDK compact_error）
  }),
]);

export type StreamMessage = z.infer<typeof StreamMessageSchema>;

// dicegm 域流消息（loregm-ws 裁决 §二 C5：拆 DiceStreamMessage / LoreStreamMessage 两个 schema）。
// StreamMessageSchema / StreamMessage 仍为 dicegm 域的既有名（跑团侧广泛引用、保持向后兼容），
// 这里补对称别名 DiceStreamMessage*，让「按 kind 区分两域流消息」在类型层显式。
export const DiceStreamMessageSchema = StreamMessageSchema;
export type DiceStreamMessage = StreamMessage;

// loregm 域流消息（构建会话 WS，hidden-roll-and-loregm-ws 裁决 §二）。
// v1 五类 + error（validate_result 推后 v2，RT-FE11 同步端点已覆盖 on-demand 校验）：
//  · turn_started {turnId}                  —— send_to_builder 收到指令、开始一轮
//  · turn_ended   {turnId, seq}             —— build GM 一轮跑完（seq=Draft 修订号，对接 get_draft 可回读）
//  · toolcall     {tool, args, result?, ok} —— build GM 每调一次构建工具（前端「显示调了哪些工具」）
//  · draft_delta  {seq, changes}            —— build GM 写 Draft（onBuilderWrite hook，即写即读刷新，对齐 GET …/draft 分域）
//  · error        {code, message}           —— 构建出错
// 与 DiceStreamMessage 共用 wsHub 骨架、事件类型枚举不同；客户端按 kind 订阅对应枚举。
export const LoreStreamMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("turn_started"), turnId: z.string() }),
  z.object({ ...base, type: z.literal("turn_ended"), turnId: z.string(), seq: z.number() }),
  z.object({
    ...base, type: z.literal("toolcall"),
    tool: z.string(), args: z.unknown(), result: z.unknown().optional(), ok: z.boolean(),
  }),
  z.object({
    ...base, type: z.literal("draft_delta"),
    seq: z.number(), changes: z.array(z.object({ section: z.string() })),
  }),
  z.object({ ...base, type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type LoreStreamMessage = z.infer<typeof LoreStreamMessageSchema>;

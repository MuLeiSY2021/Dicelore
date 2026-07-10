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
  z.object({
    ...base, type: z.literal("turn_ended"), turnId: z.string(), seq: z.number(),
    usage: z.object({
      inputTokens: z.number(), outputTokens: z.number(),
      cacheReadTokens: z.number(), cacheCreationTokens: z.number(),
    }).optional(),
  }),
  z.object({ ...base, type: z.literal("game_end"), reason: z.string(), outcome: z.string() }),
  z.object({ ...base, type: z.literal("error"), code: z.string(), message: z.string() }),
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

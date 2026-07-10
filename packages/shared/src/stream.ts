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

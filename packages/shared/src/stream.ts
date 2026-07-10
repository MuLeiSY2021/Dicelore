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
]);

export type StreamMessage = z.infer<typeof StreamMessageSchema>;

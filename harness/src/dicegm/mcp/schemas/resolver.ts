// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// src/mcp/schemas/resolver.ts
import { z } from "zod";

// ===== resolver =====
const choiceOption = z.object({ label: z.string(), consequence: z.string() });

export const resolveChoiceIn = z
  .object({ prompt: z.string(), options: z.array(choiceOption).min(2) })
  .strict();
export const resolveChoiceOut = z.object({
  staged: z.literal(true),
  options: z.array(choiceOption),
  reminders: z.array(z.string()).optional(),
});

// RT-FE5：每档强制 plan(真实后果计划·驱动机械·骰前锁定·可含暗值) + narration(玩家可见叙述·可留白)。
// 两字段必填——缺任一 → 校验失败(声明后果在先铁律)。原单一 consequence 就此作废(plan 继承其真相层职责)。
const band = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  plan: z.string(),
  narration: z.string(),
});
export const resolveOutcomeIn = z
  .object({ context: z.string(), die: z.string(), bands: z.array(band).min(1) })
  .strict();
export const resolveOutcomeOut = z.object({
  roll: z.number(),
  die: z.string(),
  band: z.object({ label: z.string(), consequence: z.string() }),
  event_id: z.number(),
  context: z.string().optional(), // 暗骰:回显裁决描述,供 notify 映射 hidden_roll.label(明骰 *_open 不含)
  reminders: z.array(z.string()).optional(),
});

const contestSideIn = z.object({ name: z.string(), expr: z.string() });
export const resolveContestIn = z
  .object({ context: z.string(), a: contestSideIn, b: contestSideIn })
  .strict();
export const contestSideOut = z.object({ name: z.string(), total: z.number(), rolls: z.array(z.number()) });
export const resolveContestOut = z.object({
  a: contestSideOut,
  b: contestSideOut,
  winner: z.enum(["a", "b", "tie"]),
  event_id: z.number(),
  context: z.string().optional(), // 暗骰:回显裁决描述,供 notify 映射 hidden_roll.label(明骰 *_open 不含)
  reminders: z.array(z.string()).optional(),
});

// ===== 明骰(玩家闸控、阻塞):入参同暗骰,出参加 awaiting 标记 =====
export const resolveOutcomeOpenIn = resolveOutcomeIn;
export const resolveOutcomeOpenOut = z.object({
  awaiting: z.literal("player_roll"),
  roll: z.number(),
  die: z.string(),
  band: z.object({ label: z.string(), consequence: z.string() }),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});
export const resolveContestOpenIn = resolveContestIn;
export const resolveContestOpenOut = z.object({
  awaiting: z.literal("player_roll"),
  a: contestSideOut,
  b: contestSideOut,
  winner: z.enum(["a", "b", "tie"]),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});

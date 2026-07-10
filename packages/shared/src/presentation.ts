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

// §1 机械回显可见种类（与 backend EventKind 的机械子集对齐）
export const MechanicKind = z.enum(["verdict", "mutation", "watcher_fired"]);

export const SheetCellSchema = z.object({
  attr: z.string(),
  value: z.string(),
  visible: z.number(),
});
export const SheetGroupSchema = z.object({
  entity: z.string(),
  cells: z.array(SheetCellSchema),
});
export const MechanicEntrySchema = z.object({
  seq: z.number(),
  kind: MechanicKind,
  text: z.string(),
  data: z.unknown().optional(),
});
export const ChoiceOptionSchema = z.object({
  index: z.number(),
  label: z.string(),
  consequence: z.string(),
});
export const ChoicesViewSchema = z.object({
  eventId: z.number(),
  options: z.array(ChoiceOptionSchema),
});

// 明骰待掷规格（只含规格、无结果；exprDisplay 如 "1d20+{说服}"，真值不下发）
// RT-FE5：每档双叙述——plan(AI 真实计划·驱动机械·可含暗值/剧透·骰前锁定) + narration(玩家可见·可留白悬疑·不吐暗值)。
// 两字段均全量随 roll_staged 下发，显隐纯交前端 spoiler 档渲染（与 visible 正交、不剥字段）。
export const RollBandSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  plan: z.string(),
  narration: z.string(),
});
export const PendingRollSchema = z.object({
  eventId: z.number(),
  shape: z.enum(["outcome", "contest"]),
  label: z.string(),
  yourSide: z.object({ name: z.string(), exprDisplay: z.string() }),
  dc: z.number().optional(),
  bands: z.array(RollBandSchema).optional(),
});

// §7(A′) 叙事层视图投影(玩家可见范围·防剧透)。front 不在此列(GM 工具、不下发玩家)。
// plotline=玩家已知主线走向(active+closed)；foreshadow=已回收且 show 的伏笔；lore=已 show 世界设定。
export const PlotlineViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullish(),
  status: z.string(),
});
export const ForeshadowViewSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.string(),
});
export const LoreViewSchema = z.object({
  name: z.string(),
  content: z.string(),
  category: z.string().nullish(),
});

// §1 全量快照（GET /presentation 与 WS 重连补齐）
export const PresentationSnapshotSchema = z.object({
  protocol: z.literal(CLIENT_PROTOCOL),
  sessionId: z.string(),
  seq: z.number(),
  sheets: z.array(SheetGroupSchema),
  mechanics: z.array(MechanicEntrySchema),
  choices: ChoicesViewSchema.nullable(),
  narrativeCursor: z.number(),
  pendingRoll: PendingRollSchema.nullish(),
  // §7(A′) 叙事层字段(RT-FE4 收口)。省略=旧客户端兼容;buildSnapshot 恒下发(可空数组)。
  plotlines: z.array(PlotlineViewSchema).optional(),
  foreshadows: z.array(ForeshadowViewSchema).optional(),
  lore: z.array(LoreViewSchema).optional(),
});

// §4 presentation_delta.changes（webhook 驱动的局部）
export const PresentationChangesSchema = z.object({
  sheets: z
    .array(SheetCellSchema.extend({ entity: z.string(), op: z.enum(["upsert", "remove"]) }))
    .optional(),
  mechanics: z.array(MechanicEntrySchema).optional(),
  reveal: z.array(z.object({ seq: z.number(), target: z.string(), text: z.string() })).optional(),
  watcherFired: z
    .array(z.object({ seq: z.number(), watcherId: z.number(), payload: z.string() }))
    .optional(),
  // §7(A′) 叙事层局部增量(op=upsert 进入玩家可见/remove 退出)。web 收到后 GET /presentation 全量对账。
  plotlines: z
    .array(PlotlineViewSchema.extend({ op: z.enum(["upsert", "remove"]) }))
    .optional(),
  foreshadows: z
    .array(ForeshadowViewSchema.extend({ op: z.enum(["upsert", "remove"]) }))
    .optional(),
  lore: z.array(LoreViewSchema.extend({ op: z.enum(["upsert", "remove"]) })).optional(),
});
export const PresentationDeltaSchema = z.object({
  seq: z.number(),
  changes: PresentationChangesSchema,
});

export type SheetCell = z.infer<typeof SheetCellSchema>;
export type SheetGroup = z.infer<typeof SheetGroupSchema>;
export type MechanicEntry = z.infer<typeof MechanicEntrySchema>;
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type ChoicesView = z.infer<typeof ChoicesViewSchema>;
export type PendingRoll = z.infer<typeof PendingRollSchema>;
export type PlotlineView = z.infer<typeof PlotlineViewSchema>;
export type ForeshadowView = z.infer<typeof ForeshadowViewSchema>;
export type LoreView = z.infer<typeof LoreViewSchema>;
export type PresentationSnapshot = z.infer<typeof PresentationSnapshotSchema>;
export type PresentationChanges = z.infer<typeof PresentationChangesSchema>;
export type PresentationDelta = z.infer<typeof PresentationDeltaSchema>;

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";

// ===== sheet =====
// A′ §4：裸 sheet_get/sheet_list 已删（类型化读替代，见 backend/src/stdlib），其 in/out schema 一并移除。
// 仅保留即兴兜底写 sheet_update 的 schema。

const mutation = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  expr: z.string(),
  visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
});
export const sheetUpdateIn = z.object({ entity: z.string(), mutations: z.array(mutation).min(1) }).strict();
const appliedOut = z.object({
  attr: z.string(),
  op: z.enum(["+", "-", "="]),
  kind: z.enum(["rolled", "set"]),
  old: z.string().nullable(),
  rolls: z.array(z.number()).optional(),
  delta: z.number().optional(),
  new: z.string(),
});
export const sheetUpdateOut = z.object({
  entity: z.string(),
  applied: z.array(appliedOut),
  fired_watchers: z.array(z.object({ id: z.number(), payload: z.string() })).optional(),
  event_id: z.number(),
  reminders: z.array(z.string()).optional(),
});

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";

// ===== world =====
export const worldSearchIn = z
  .object({ query: z.string(), k: z.number().int().min(1).max(100).default(20), category: z.string().optional() })
  .strict();
export const worldSearchOut = z.object({
  docs: z.array(z.object({ name: z.string(), content: z.string(), category: z.string().nullable(), visible: z.number() })),
  truncated: z.boolean(),
});

export const worldSampleIn = z
  .object({
    pool: z.string(),
    n: z.number().int().min(1).default(1),
    filter: z.record(z.union([z.string(), z.number()])).optional(),
  })
  .strict();
export const worldSampleOut = z.object({ rows: z.array(z.record(z.unknown())) });

export const worldRegisterIn = z
  .object({
    target: z.enum(["doc", "pool"]),
    doc: z.object({ name: z.string(), content: z.string(), category: z.string().optional(), tags: z.string().optional() }).optional(),
    pool: z.object({ pool: z.string(), row: z.record(z.unknown()), weight: z.number().default(1) }).optional(),
    visible: z.union([z.literal(0), z.literal(1)]).default(0),
  })
  .strict();
// 注:target↔doc/pool 一致性校验下沉到 registerHandler(refine 会产出 ZodEffects,与 ToolDef.inputSchema:ZodObject 及 main.ts 的 .shape 不兼容)。
export const worldRegisterOut = z.object({ ok: z.literal(true), rowid: z.number() });

// ===== rule =====
export const ruleSearchIn = z.object({ query: z.string(), k: z.number().int().min(1).max(100).default(20) }).strict();
export const ruleSearchOut = z.object({
  rules: z.array(z.object({ name: z.string(), content: z.string(), version: z.number() })),
  truncated: z.boolean(),
});

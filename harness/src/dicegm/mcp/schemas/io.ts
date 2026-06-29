// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";

// ===== visibility / output =====
export const sheetShowIn = z
  .object({ entity: z.string(), attrs: z.array(z.string()).optional(), recursive: z.boolean().default(false) })
  .strict();
export const sheetShowOut = z.object({ shown: z.array(z.string()), ok: z.literal(true), audit_event_id: z.number() });

export const worldShowIn = z
  .object({ doc: z.string().optional(), pool_rowid: z.number().int().optional() })
  .strict();
export const worldShowOut = z.object({ ok: z.literal(true), audit_event_id: z.number() });

export const revealOnceIn = z
  .object({
    sheet: z.object({ entity: z.string(), attr: z.string() }).optional(),
    world: z.object({ rowid: z.number().int() }).optional(),
  })
  .strict();
export const revealOnceOut = z.object({ event_id: z.number() });

export const narrateIn = z.object({ text: z.string(), tags: z.array(z.string()).optional() }).strict();
export const narrateOut = z.object({ event_id: z.number() });

export const gameEndIn = z.object({ reason: z.string(), outcome: z.string().optional() }).strict();
export const gameEndOut = z.object({ ended: z.literal(true), event_id: z.number() });

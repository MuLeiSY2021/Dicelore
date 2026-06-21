import { z } from "zod";

// ===== visibility / output =====
export const sheetShowIn = z
  .object({ entity: z.string(), attrs: z.array(z.string()).optional(), recursive: z.boolean().default(false) })
  .strict();
export const sheetShowOut = z.object({ shown: z.array(z.string()), ok: z.literal(true) });

export const worldShowIn = z
  .object({ doc: z.string().optional(), pool_rowid: z.number().int().optional() })
  .strict();
export const worldShowOut = z.object({ ok: z.literal(true) });

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

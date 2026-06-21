import { z } from "zod";

// ===== event =====
export const eventAppendIn = z
  .object({
    content: z.string().optional(),
    kind: z
      .enum(["narrate", "note", "verdict", "mutation", "watcher_fired", "reveal"])
      .default("note"),
    data_json: z.unknown().optional(),
    tags: z.array(z.string()).optional(),
    visible: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict();
export const eventAppendOut = z.object({ event_id: z.number() });

export const eventRecallIn = z
  .object({ query: z.string(), k: z.number().int().min(1).max(100).default(8) })
  .strict();
const eventRowOut = z.object({
  seq: z.number(),
  kind: z.string(),
  content: z.string().nullable(),
  visible: z.number(),
});
export const eventRecallOut = z.object({
  events: z.array(eventRowOut),
  truncated: z.boolean(),
});

export const watcherSetIn = z
  .object({
    condition: z.string(),
    payload: z.string(),
    mode: z.enum(["once", "repeat"]).default("once"),
  })
  .strict();
export const watcherSetOut = z.object({ watcher_id: z.number() });

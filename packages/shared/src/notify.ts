import { z } from "zod";
import { NOTIFY_PROTOCOL } from "./protocol.js";

export const NotifyKind = z.enum([
  "mutation", "event", "visibility", "reveal",
  "watcher_fired", "choice_staged", "game_end", "bulk",
]);

export const NotifyPayloadSchema = z.object({
  protocol: z.literal(NOTIFY_PROTOCOL),
  sessionId: z.string(),
  seq: z.number(),
  kind: NotifyKind,
  delta: z.record(z.unknown()).optional(), // bulk 时缺省/空，提示后端回读全量快照
});

export type NotifyKind = z.infer<typeof NotifyKind>;
export type NotifyPayload = z.infer<typeof NotifyPayloadSchema>;

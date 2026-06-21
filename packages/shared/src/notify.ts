// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

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

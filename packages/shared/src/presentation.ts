import { z } from "zod";
import { CLIENT_PROTOCOL } from "./protocol.js";

// §1 机械回显可见种类（与 core EventKind 的机械子集对齐）
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

// §1 全量快照（GET /presentation 与 WS 重连补齐）
export const PresentationSnapshotSchema = z.object({
  protocol: z.literal(CLIENT_PROTOCOL),
  sessionId: z.string(),
  seq: z.number(),
  sheets: z.array(SheetGroupSchema),
  mechanics: z.array(MechanicEntrySchema),
  choices: ChoicesViewSchema.nullable(),
  narrativeCursor: z.number(),
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
export type PresentationSnapshot = z.infer<typeof PresentationSnapshotSchema>;
export type PresentationDelta = z.infer<typeof PresentationDeltaSchema>;

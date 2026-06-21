import { z } from "zod";

export const MessageRequestSchema = z.object({ text: z.string() });
export const MessageResponseSchema = z.object({ turnId: z.string() });
export const ChoiceRequestSchema = z.object({ eventId: z.number(), optionIndex: z.number() });
export const ChoiceResponseSchema = z.object({ turnId: z.string() });
export const CreateSessionRequestSchema = z.object({
  teamId: z.string().optional(),
  resume: z.string().optional(),
});
export const CreateSessionResponseSchema = z.object({ sessionId: z.string() });
export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  ended: z.boolean(),
  title: z.string(),
});
export const EventRowSchema = z.object({
  seq: z.number(),
  kind: z.string(),
  text: z.string(),
  data: z.unknown().optional(),
});
export const EventsResponseSchema = z.object({ events: z.array(EventRowSchema) });

export const SessionStatusSchema = z.enum(["active", "archived", "ended"]);
export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  title: z.string(),
  status: SessionStatusSchema,
  updatedAt: z.number().optional(), // epoch ms；无则省略
});
export const SessionsListResponseSchema = z.object({ sessions: z.array(SessionSummarySchema) });

export type MessageRequest = z.infer<typeof MessageRequestSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ChoiceRequest = z.infer<typeof ChoiceRequestSchema>;
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type EventRow = z.infer<typeof EventRowSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionsListResponse = z.infer<typeof SessionsListResponseSchema>;

import { z } from "zod";
import {
  FlagSeverityEnum,
  idSchema,
  optionalTrimmedString,
  RegionEnum,
  ScrimFormatEnum,
  ScrimStatusEnum,
  urlSchema,
} from "./common";

export const createScrimRequestSchema = z.object({
  teamId: idSchema,
  gameId: idSchema,
  date: z.coerce.date().refine((date) => date > new Date(), {
    message: "Date must be in the future",
  }),
  durationMinutes: z
    .number()
    .min(30, "Duration must be at least 30 minutes")
    .max(300, "Duration cannot exceed 5 hours")
    .default(120),
  minElo: z.number().min(0).default(0),
  maxElo: z.number().min(0).default(5000),
  serverRegion: RegionEnum.optional(),
  preferredMaps: z.array(idSchema).min(1).optional(),
  note: optionalTrimmedString(255),
});

export const createScrimSchema = z.object({
  organizationId: idSchema,
  gameId: idSchema,
  scheduledStart: z.coerce.date().refine((date) => date > new Date(), {
    message: "Scheduled time must be in the future",
  }),
  format: ScrimFormatEnum.default("BO1"),
  opponentId: idSchema.optional(),
  title: optionalTrimmedString(255),
});

export const reportScrimResultSchema = z.object({
  scrimId: idSchema,
  matchData: z
    .array(
      z.object({
        mapId: idSchema,
        winnerTeamId: idSchema,
        scoreTeamA: z.number().min(0, "Score cannot be negative"),
        scoreTeamB: z.number().min(0, "Score cannot be negative"),
        screenshotUrl: urlSchema.optional(),
      }),
    )
    .min(1, "At least one match result is required"),
});

export const updateScrimStatusSchema = z
  .object({
    scrimId: idSchema,
    status: ScrimStatusEnum,
    cancellationReason: optionalTrimmedString(255),
  })
  .refine((data) => data.status !== "CANCELLED" || data.cancellationReason, {
    message: "Provide a cancellation reason",
    path: ["cancellationReason"],
  });

export const updateScrimScheduleSchema = z.object({
  scrimId: idSchema,
  scheduledStart: z.coerce.date().refine((date) => date > new Date(), {
    message: "Scheduled time must be in the future",
  }),
  serverConnectionString: optionalTrimmedString(500),
  title: optionalTrimmedString(255),
});

export const createScrimGameSchema = z.object({
  scrimId: idSchema,
  mapId: idSchema,
  mode: optionalTrimmedString(50)
    .refine((value) => Boolean(value), {
      message: "Mode is required",
    })
    .transform((value) => value as string),
  orderIndex: z.number().int().nonnegative(),
});

export const scrimMessageSchema = z.object({
  scrimId: idSchema,
  content: optionalTrimmedString(2000).refine((value) => Boolean(value), {
    message: "Message content is required",
  }),
});

export const scrimChecklistItemSchema = z.object({
  scrimId: idSchema,
  label: optionalTrimmedString(150).refine((value) => Boolean(value), {
    message: "Label is required",
  }),
  required: z.boolean().default(true),
});

export const completeScrimChecklistItemSchema = z.object({
  checklistId: idSchema,
  completed: z.boolean().default(true),
});

export const scrimModerationFlagSchema = z.object({
  scrimId: idSchema,
  reason: optionalTrimmedString(255).refine((value) => Boolean(value), {
    message: "Reason is required",
  }),
  severity: FlagSeverityEnum.default("MEDIUM"),
});

export const scrimResultVerificationSchema = z.object({
  scrimId: idSchema,
  notes: optionalTrimmedString(255),
});

export const addScrimParticipantSchema = z.object({
  scrimId: idSchema,
  teamId: idSchema,
  isHost: z.boolean().default(false),
});

export const upsertScrimLineupSchema = z.object({
  scrimParticipantId: idSchema,
  userId: idSchema,
  teamMemberId: idSchema.optional(),
  isSubstitute: z.boolean().default(false),
  rolePlayed: optionalTrimmedString(50),
});

export const scrimGameScreenshotSchema = z.object({
  scrimGameId: idSchema,
  fileUrl: urlSchema,
});

const statValueSchema = z.union([z.number(), z.boolean(), z.string()]);

export const submitPlayerGameStatsSchema = z.object({
  scrimGameId: idSchema,
  userId: idSchema,
  scrimParticipantId: idSchema,
  teamId: idSchema,
  isSubstitute: z.boolean().default(false),
  rolePlayed: optionalTrimmedString(50),
  won: z.boolean(),
  stats: z.record(z.string(), statValueSchema),
});

export type CreateScrimRequestInput = z.infer<typeof createScrimRequestSchema>;
export type CreateScrimInput = z.infer<typeof createScrimSchema>;
export type ReportScrimResultInput = z.infer<typeof reportScrimResultSchema>;
export type UpdateScrimStatusInput = z.infer<typeof updateScrimStatusSchema>;
export type UpdateScrimScheduleInput = z.infer<
  typeof updateScrimScheduleSchema
>;
export type CreateScrimGameInput = z.infer<typeof createScrimGameSchema>;
export type ScrimMessageInput = z.infer<typeof scrimMessageSchema>;
export type ScrimChecklistItemInput = z.infer<typeof scrimChecklistItemSchema>;
export type CompleteScrimChecklistItemInput = z.infer<
  typeof completeScrimChecklistItemSchema
>;
export type ScrimModerationFlagInput = z.infer<
  typeof scrimModerationFlagSchema
>;
export type ScrimResultVerificationInput = z.infer<
  typeof scrimResultVerificationSchema
>;
export type AddScrimParticipantInput = z.infer<
  typeof addScrimParticipantSchema
>;
export type UpsertScrimLineupInput = z.infer<typeof upsertScrimLineupSchema>;
export type ScrimGameScreenshotInput = z.infer<
  typeof scrimGameScreenshotSchema
>;
export type SubmitPlayerGameStatsInput = z.infer<
  typeof submitPlayerGameStatsSchema
>;

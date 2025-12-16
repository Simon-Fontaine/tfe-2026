import { z } from "zod";
import {
  idSchema,
  optionalTrimmedString,
  RegionEnum,
  ScrimFormatEnum,
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

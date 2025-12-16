import { z } from "zod";
import { TEAM_ROLES } from "../constants";
import { emailSchema, idSchema, trimmedString } from "./common";

export const createTeamSchema = z.object({
  organizationId: idSchema,
  gameId: idSchema,
  name: trimmedString(2, 50, "Team name must be between 2 and 50 characters"),
  acronym: z
    .string()
    .trim()
    .min(2, "Acronym must be at least 2 characters")
    .max(6, "Acronym cannot exceed 6 characters")
    .regex(/^[A-Z0-9]+$/, "Acronym must be uppercase alphanumeric"),
});

export const inviteMemberSchema = z.object({
  teamId: idSchema,
  email: emailSchema,
  role: z.enum(TEAM_ROLES).default("player"),
});

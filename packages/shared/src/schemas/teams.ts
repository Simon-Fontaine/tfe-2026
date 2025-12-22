import { z } from "zod";
import {
  AvailabilityStatusEnum,
  DayOfWeekEnum,
  emailSchema,
  idSchema,
  optionalTrimmedString,
  ScrimPreferenceTypeEnum,
  TeamRoleEnum,
  TeamRosterStatusEnum,
  timeStringSchema,
  trimmedString,
} from "./common";

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

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
  role: TeamRoleEnum.default("player"),
  message: optionalTrimmedString(255),
});

export const updateTeamSchema = z
  .object({
    teamId: idSchema,
    name: optionalTrimmedString(50),
    acronym: z
      .string()
      .trim()
      .min(2, "Acronym must be at least 2 characters")
      .max(6, "Acronym cannot exceed 6 characters")
      .regex(/^[A-Z0-9]+$/, "Acronym must be uppercase alphanumeric")
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.acronym !== undefined, {
    message: "Provide at least one field to update",
  });

export const addTeamMemberSchema = z.object({
  teamId: idSchema,
  userId: idSchema,
  role: TeamRoleEnum.default("player"),
  rosterStatus: TeamRosterStatusEnum.default("SUBSTITUTE"),
  ingameRole: optionalTrimmedString(50),
});

export const updateTeamMemberSchema = z
  .object({
    teamId: idSchema,
    userId: idSchema,
    role: TeamRoleEnum.optional(),
    rosterStatus: TeamRosterStatusEnum.optional(),
    ingameRole: optionalTrimmedString(50),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.rosterStatus !== undefined ||
      data.ingameRole !== undefined,
    {
      message: "Provide at least one field to update",
    },
  );

export const removeTeamMemberSchema = z.object({
  teamId: idSchema,
  userId: idSchema,
});

export const respondTeamInviteSchema = z.object({
  token: trimmedString(6, 128, "Invite token is required"),
  action: z.enum(["accept", "decline"]),
});

export const createTeamInviteSchema = z.object({
  teamId: idSchema,
  invitedUserId: idSchema,
  role: TeamRoleEnum.default("player"),
  message: optionalTrimmedString(255),
  expiresAt: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      message: "Expiration must be in the future",
    })
    .optional(),
});

export const setTeamAvailabilitySchema = z.object({
  teamId: idSchema,
  slots: z
    .array(
      z
        .object({
          dayOfWeek: DayOfWeekEnum,
          startTime: timeStringSchema,
          endTime: timeStringSchema,
        })
        .refine((slot) => toMinutes(slot.endTime) > toMinutes(slot.startTime), {
          message: "endTime must be after startTime",
          path: ["endTime"],
        }),
    )
    .min(1, "Provide at least one availability slot"),
});

export const addTeamBlackoutSchema = z
  .object({
    teamId: idSchema,
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: optionalTrimmedString(255),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const setTeamScrimPreferenceSchema = z
  .object({
    teamId: idSchema,
    targetOrganizationId: idSchema.optional(),
    targetTeamId: idSchema.optional(),
    preference: ScrimPreferenceTypeEnum,
    note: optionalTrimmedString(255),
  })
  .refine(
    (data) =>
      data.targetOrganizationId !== undefined ||
      data.targetTeamId !== undefined,
    {
      message: "Select a target organization or team",
      path: ["targetOrganizationId"],
    },
  );

export const setPlayerAvailabilitySchema = z.object({
  teamId: idSchema,
  userId: idSchema,
  entries: z
    .array(
      z
        .object({
          dayOfWeek: DayOfWeekEnum,
          startTime: timeStringSchema,
          endTime: timeStringSchema,
          status: AvailabilityStatusEnum.default("AVAILABLE"),
          note: optionalTrimmedString(255),
        })
        .refine(
          (entry) => toMinutes(entry.endTime) > toMinutes(entry.startTime),
          {
            message: "endTime must be after startTime",
            path: ["endTime"],
          },
        ),
    )
    .min(1, "Provide at least one availability entry"),
});

export const addPlayerAvailabilityExceptionSchema = z
  .object({
    teamId: idSchema,
    userId: idSchema,
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    status: AvailabilityStatusEnum.default("UNAVAILABLE"),
    reason: optionalTrimmedString(255),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const updateTeamRoleLimitsSchema = z.object({
  teamId: idSchema,
  limits: z
    .array(
      z.object({
        role: TeamRoleEnum,
        maxCount: z
          .number()
          .int()
          .min(1, "maxCount must be positive")
          .max(100, "maxCount is too large"),
      }),
    )
    .min(1, "Provide at least one role limit"),
});

export const createTeamRosterLockSchema = z
  .object({
    teamId: idSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    reason: optionalTrimmedString(255),
  })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type RemoveTeamMemberInput = z.infer<typeof removeTeamMemberSchema>;
export type RespondTeamInviteInput = z.infer<typeof respondTeamInviteSchema>;
export type CreateTeamInviteInput = z.infer<typeof createTeamInviteSchema>;
export type SetTeamAvailabilityInput = z.infer<
  typeof setTeamAvailabilitySchema
>;
export type AddTeamBlackoutInput = z.infer<typeof addTeamBlackoutSchema>;
export type SetTeamScrimPreferenceInput = z.infer<
  typeof setTeamScrimPreferenceSchema
>;
export type SetPlayerAvailabilityInput = z.infer<
  typeof setPlayerAvailabilitySchema
>;
export type AddPlayerAvailabilityExceptionInput = z.infer<
  typeof addPlayerAvailabilityExceptionSchema
>;
export type UpdateTeamRoleLimitsInput = z.infer<
  typeof updateTeamRoleLimitsSchema
>;
export type CreateTeamRosterLockInput = z.infer<
  typeof createTeamRosterLockSchema
>;

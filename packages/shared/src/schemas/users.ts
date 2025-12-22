import { z } from "zod";
import {
  emailSchema,
  idSchema,
  optionalTrimmedString,
  optionalUrlSchema,
  ProviderEnum,
  trimmedString,
} from "./common";

export const userNotificationPreferencesSchema = z.object({
  email_match_found: z.boolean().default(true),
  email_scrim_reminder: z.boolean().default(true),
  push_new_message: z.boolean().default(true),
});

export const updateProfileSchema = z.object({
  username: optionalTrimmedString(30),
  avatarUrl: optionalUrlSchema,
  country: z
    .string()
    .trim()
    .length(2, "Country must be ISO-2")
    .transform((value) => value.toUpperCase())
    .optional(),
  timezone: optionalTrimmedString(50),
});

export const changeEmailSchema = z.object({
  email: emailSchema,
  password: trimmedString(
    8,
    255,
    "Password must be at least 8 characters long",
  ),
});

export const changePasswordSchema = z
  .object({
    currentPassword: trimmedString(8, 255, "Current password is required"),
    newPassword: trimmedString(
      8,
      255,
      "New password must be at least 8 characters long",
    ),
    confirmNewPassword: trimmedString(8, 255, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const deleteAccountSchema = z.object({
  token: trimmedString(6, 255, "Token is required"),
});

export const confirmEmailChangeSchema = z.object({
  token: trimmedString(6, 255, "Token is required"),
});

export const linkProviderAccountSchema = z.object({
  provider: ProviderEnum,
  providerAccountId: trimmedString(1, 255, "Provider account id is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const unlinkProviderAccountSchema = z.object({
  provider: ProviderEnum,
  providerAccountId: trimmedString(1, 255, "Provider account id is required"),
});

export const updateNotificationPreferencesSchema = z.object({
  email_match_found: z.boolean().optional(),
  email_scrim_reminder: z.boolean().optional(),
  push_new_message: z.boolean().optional(),
});

export const markNotificationReadSchema = z.object({
  notificationId: idSchema,
});

export const markAllNotificationsReadSchema = z.object({
  upTo: z.coerce.date().optional(),
});

export type UserNotificationPreferencesInput = z.infer<
  typeof userNotificationPreferencesSchema
>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>;
export type LinkProviderAccountInput = z.infer<
  typeof linkProviderAccountSchema
>;
export type UnlinkProviderAccountInput = z.infer<
  typeof unlinkProviderAccountSchema
>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;
export type MarkAllNotificationsReadInput = z.infer<
  typeof markAllNotificationsReadSchema
>;

import { z } from "zod";
import {
  emailSchema,
  optionalTrimmedString,
  optionalUrlSchema,
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

export type UserNotificationPreferencesInput = z.infer<
  typeof userNotificationPreferencesSchema
>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

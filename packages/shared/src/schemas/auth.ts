import { z } from "zod";
import { emailSchema, trimmedString, VerificationTypeEnum } from "./common";

export const usernameSchema = trimmedString(
  3,
  30,
  "Username must be between 3 and 30 characters",
).regex(
  /^[a-zA-Z0-9_]+$/,
  "Username can only contain alphanumeric characters and underscores",
);

export const passwordSchema = trimmedString(
  8,
  255,
  "Password must be at least 8 characters long",
);

const verificationTokenSchema = trimmedString(
  6,
  255,
  "Verification token is required",
);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const verifyCodeSchema = z.object({
  token: verificationTokenSchema,
  email: emailSchema,
  type: VerificationTypeEnum.default("EMAIL_VERIFICATION"),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
  type: VerificationTypeEnum.default("EMAIL_VERIFICATION"),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: verificationTokenSchema,
    newPassword: passwordSchema,
    confirmNewPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const requestEmailVerificationSchema = z.object({
  email: emailSchema,
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RequestEmailVerificationInput = z.infer<
  typeof requestEmailVerificationSchema
>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

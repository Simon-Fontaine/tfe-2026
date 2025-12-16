import { z } from "zod";
import { emailSchema, trimmedString } from "./common";

const usernameSchema = trimmedString(
  3,
  30,
  "Username must be between 3 and 30 characters",
).regex(
  /^[a-zA-Z0-9_]+$/,
  "Username can only contain alphanumeric characters and underscores",
);

const passwordSchema = trimmedString(
  8,
  255,
  "Password must be at least 8 characters long",
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

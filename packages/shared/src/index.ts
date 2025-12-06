import { z } from "zod";

export const idSchema = z.uuid();

export const loginSchema = z.object({
  email: z.email({ message: "" }),
  password: z.string().min(8, { message: "" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

import { loginSchema } from "@workspaces/shared";

console.log(
  loginSchema.safeParse({ email: "test@test.com", password: "password123" }),
);

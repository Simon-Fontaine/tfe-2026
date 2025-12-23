import { zValidator } from "@hono/zod-validator";
import {
  env,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyCodeSchema,
} from "@workspaces/shared";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { AuthService } from "../services/auth.service";

const auth = new Hono();

const getClientIp = (c: Context) => {
  const xff = c.req.header("x-forwarded-for");
  return xff ? (xff.split(",")[0]?.trim() ?? "unknown") : "unknown";
};

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  try {
    const result = await AuthService.register(c.req.valid("json"));
    return c.json(
      { message: "Account created, check emails", userId: result.userId },
      201,
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "EMAIL_OR_USERNAME_TAKEN")
      return c.json({ error: "Email or Username already taken" }, 409);
    return c.json({ error: "Internal Error" }, 500);
  }
});

auth.post("/verify-email", zValidator("json", verifyCodeSchema), async (c) => {
  try {
    const { token } = c.req.valid("json");
    await AuthService.verifyCode(token, "EMAIL_VERIFICATION");
    return c.json({ message: "Email verified successfully" });
  } catch (_error: unknown) {
    return c.json({ error: "Invalid or expired code" }, 400);
  }
});

auth.post(
  "/resend-verification",
  zValidator("json", resendVerificationSchema),
  async (c) => {
    try {
      await AuthService.resendVerificationCode(c.req.valid("json"));
      return c.json({
        message:
          "If an account exists for this email, a verification code has been sent.",
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "UNSUPPORTED_VERIFICATION_TYPE"
      ) {
        return c.json({ error: "Unsupported verification type" }, 400);
      }

      return c.json({ error: "Internal Error" }, 500);
    }
  },
);

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json");
    const ip = getClientIp(c);
    const userAgent = c.req.header("user-agent");

    const { session, user } = await AuthService.login(
      { email, password },
      ip,
      userAgent,
    );

    setCookie(c, "session_token", session.sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "Lax",
      expires: session.expiresAt,
      path: "/",
    });

    return c.json({ message: "Logged in", user });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "EMAIL_NOT_VERIFIED")
      return c.json(
        { error: "Verify email first", code: "EMAIL_NOT_VERIFIED" },
        403,
      );
    return c.json({ error: "Invalid credentials" }, 401);
  }
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, "session_token");
  if (token) {
    await AuthService.logout(token);
    deleteCookie(c, "session_token");
  }
  return c.json({ message: "Logged out" });
});

auth.get("/me", async (c) => {
  const token = getCookie(c, "session_token");
  if (!token) return c.json({ user: null }, 401);

  const data = await AuthService.getSessionUser(token);
  if (!data) {
    deleteCookie(c, "session_token");
    return c.json({ user: null }, 401);
  }

  return c.json({
    user: {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      globalRole: data.user.globalRole,
      avatarUrl: data.user.avatarUrl,
    },
  });
});

export default auth;

import { zValidator } from "@hono/zod-validator";
import type { SessionMetadataInput } from "@workspaces/shared";
import {
  confirmDeleteAccountSchema,
  confirmEmailChangeSchema,
  env,
  loginSchema,
  registerSchema,
  requestAccountDeletionSchema,
  requestEmailChangeSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyCodeSchema,
} from "@workspaces/shared";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { UAParser } from "ua-parser-js";
import { extractClientInfo } from "../lib/geo";
import { type AuthContext, requireAuth } from "../middlewares/auth";
import { AuthService } from "../services/auth.service";
import { lookupGeo } from "../services/geo.service";

const auth = new Hono<AuthContext>();

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  try {
    const { ip, userAgent } = extractClientInfo(c);
    const geoData = await lookupGeo(ip);
    const { ua, device } = UAParser(userAgent);

    let location: SessionMetadataInput["location"];

    if (geoData?.status === "success") {
      location = {
        country: geoData.country,
        countryCode: geoData.countryCode,
        region: geoData.regionName,
        city: geoData.city,
        latitude: geoData.lat,
        longitude: geoData.lon,
        timezone: geoData.timezone,
      };
    }

    const metadata: SessionMetadataInput = {
      ipAddress: ip,
      userAgent: ua,
      device: device.model || device.type || device.vendor || "Unknown",
      location,
    };

    const result = await AuthService.register(c.req.valid("json"), metadata);

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
    const { token, email } = c.req.valid("json");
    await AuthService.verifyEmail(token, email);
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
    const { ip, userAgent } = extractClientInfo(c);
    const geoData = await lookupGeo(ip);
    const { ua, device } = UAParser(userAgent);

    let location: SessionMetadataInput["location"];

    if (geoData?.status === "success") {
      location = {
        country: geoData.country,
        countryCode: geoData.countryCode,
        region: geoData.regionName,
        city: geoData.city,
        latitude: geoData.lat,
        longitude: geoData.lon,
        timezone: geoData.timezone,
      };
    }

    const metadata: SessionMetadataInput = {
      ipAddress: ip,
      userAgent: ua,
      device: device.model || device.type || device.vendor || "Unknown",
      location,
    };

    const { session, user } = await AuthService.login(
      { email, password },
      metadata,
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
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS")
      return c.json({ error: "Invalid credentials" }, 401);
    return c.json({ error: "Internal Error" }, 500);
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

auth.post(
  "/request-password-reset",
  zValidator("json", requestPasswordResetSchema),
  async (c) => {
    try {
      await AuthService.requestPasswordReset(c.req.valid("json"));
      return c.json({
        message:
          "If an account exists for this email, a reset code has been sent.",
      });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Internal Error" }, 500);
    }
  },
);

auth.post(
  "/reset-password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    try {
      await AuthService.resetPassword(c.req.valid("json"));
      return c.json({ message: "Password reset successfully. Please login." });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Invalid code or expired" }, 400);
    }
  },
);

auth.post(
  "/confirm-email-change",
  zValidator("json", confirmEmailChangeSchema),
  async (c) => {
    try {
      const { token, email } = c.req.valid("json");
      await AuthService.confirmEmailChange(token, email);
      return c.json({ message: "Email changed successfully" });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Invalid or expired code" }, 400);
    }
  },
);

auth.get("/me", requireAuth, async (c) => {
  const user = c.var.user;
  return c.json({ user });
});

auth.post(
  "/request-email-change",
  requireAuth,
  zValidator("json", requestEmailChangeSchema),
  async (c) => {
    const user = c.var.user;
    try {
      await AuthService.requestEmailChange(user.id, c.req.valid("json"));
      return c.json({ message: "Verification code sent to new email." });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "EMAIL_TAKEN")
          return c.json({ error: "Email already taken" }, 409);
        if (error.message === "INVALID_PASSWORD")
          return c.json({ error: "Invalid password" }, 403);
      }
      return c.json({ error: "Internal Error" }, 500);
    }
  },
);

auth.post(
  "/request-delete-account",
  requireAuth,
  zValidator("json", requestAccountDeletionSchema),
  async (c) => {
    const user = c.var.user;
    try {
      await AuthService.requestAccountDeletion(
        user.id,
        c.req.valid("json").password,
      );
      return c.json({ message: "Verification code sent to your email." });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PASSWORD")
        return c.json({ error: "Invalid password" }, 403);
      return c.json({ error: "Internal Error" }, 500);
    }
  },
);

auth.post(
  "/confirm-delete-account",
  zValidator("json", confirmDeleteAccountSchema),
  async (c) => {
    try {
      const { token, email } = c.req.valid("json");
      await AuthService.confirmAccountDeletion(token, email);
      deleteCookie(c, "session_token");
      return c.json({ message: "Account deleted" });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Invalid or expired code" }, 400);
    }
  },
);

export default auth;

import { zValidator } from "@hono/zod-validator";
import db from "@workspaces/database";
import {
  sessionsTable,
  usersTable,
  verificationsTable,
} from "@workspaces/database/schema";
import {
  env,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyCodeSchema,
} from "@workspaces/shared";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { emailService } from "../lib/email";

const auth = new Hono();

function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf.at(0) ?? 0;
  return (n % 1_000_000).toString().padStart(6, "0");
}

function getClientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  if (!xff) return "unknown";

  const first = xff.split(",")[0];
  if (!first) return "unknown";

  const ip = first.trim();
  return ip || "unknown";
}

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const { username, email, password } = c.req.valid("json");

  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.email, email), eq(usersTable.username, username)))
    .limit(1);

  if (existingUser.length > 0) {
    return c.json({ error: "Email or Username already taken" }, 409);
  }

  const passwordHash = await Bun.password.hash(password);

  const insertedUsers = await db
    .insert(usersTable)
    .values({
      email,
      username,
      passwordHash,
      emailVerified: false,
    })
    .returning({ id: usersTable.id });

  const newUser = insertedUsers[0];
  if (!newUser) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(verificationsTable).values({
    userId: newUser.id,
    token: code,
    type: "EMAIL_VERIFICATION",
    expiresAt,
  });

  await emailService.sendVerificationCode(email, code);

  return c.json(
    {
      message:
        "Account created. Please check your emails for the verification code.",
      userId: newUser.id,
    },
    201,
  );
});

auth.post("/verify-email", zValidator("json", verifyCodeSchema), async (c) => {
  const { token } = c.req.valid("json");

  const rows = await db
    .select({
      verificationId: verificationsTable.id,
      userId: verificationsTable.userId,
      userEmail: usersTable.email,
    })
    .from(verificationsTable)
    .innerJoin(usersTable, eq(verificationsTable.userId, usersTable.id))
    .where(
      and(
        eq(verificationsTable.token, token),
        eq(verificationsTable.type, "EMAIL_VERIFICATION"),
        gt(verificationsTable.expiresAt, new Date()),
        isNull(verificationsTable.usedAt),
      ),
    )
    .limit(1);

  const verification = rows[0];
  if (!verification) {
    return c.json({ error: "Invalid or expired code" }, 400);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ emailVerified: true })
      .where(eq(usersTable.id, verification.userId));

    await tx
      .update(verificationsTable)
      .set({ usedAt: new Date() })
      .where(eq(verificationsTable.id, verification.verificationId));
  });

  return c.json({ message: "Email verified successfully" });
});

auth.post(
  "/resend-verification",
  zValidator("json", resendVerificationSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    const users = await db
      .select({
        id: usersTable.id,
        emailVerified: usersTable.emailVerified,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const user = users[0];

    if (!user || user.emailVerified) {
      return c.json({
        message: "If account exists and is unverified, code sent.",
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(verificationsTable)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(verificationsTable.userId, user.id),
            eq(verificationsTable.type, "EMAIL_VERIFICATION"),
            isNull(verificationsTable.usedAt),
          ),
        );

      await tx.insert(verificationsTable).values({
        userId: user.id,
        token: code,
        type: "EMAIL_VERIFICATION",
        expiresAt,
      });
    });

    await emailService.sendVerificationCode(email, code);

    return c.json({ message: "Code sent" });
  },
);

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const ipAddress = getClientIp(c);

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      globalRole: usersTable.globalRole,
      emailVerified: usersTable.emailVerified,
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  const user = users[0];

  if (!user || !user.passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const validPassword = await Bun.password.verify(password, user.passwordHash);
  if (!validPassword) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (!user.emailVerified) {
    return c.json(
      { error: "Please verify your email first", code: "EMAIL_NOT_VERIFIED" },
      403,
    );
  }

  const knownIpSession = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, user.id),
        eq(sessionsTable.ipAddress, ipAddress),
      ),
    )
    .limit(1);

  if (knownIpSession.length === 0) {
    const hasAnyHistory = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, user.id))
      .limit(1);

    if (hasAnyHistory.length > 0) {
      emailService
        .sendNewIpNotification(user.email, ipAddress)
        .catch(console.error);
    }
  }

  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await db.insert(sessionsTable).values({
    userId: user.id,
    sessionToken,
    expiresAt,
    ipAddress,
    userAgent: c.req.header("user-agent"),
  });

  setCookie(c, "session_token", sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    expires: expiresAt,
    path: "/",
  });

  return c.json({
    message: "Logged in successfully",
    user: { id: user.id, username: user.username, role: user.globalRole },
  });
});

export default auth;

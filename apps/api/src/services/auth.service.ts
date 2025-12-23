import db from "@workspaces/database";
import {
  sessionsTable,
  usersTable,
  verificationsTable,
} from "@workspaces/database/schema";
import type {
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
} from "@workspaces/shared"; //
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { emailService } from "../lib/email"; //

function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return ((buf[0] ?? 0) % 1_000_000).toString().padStart(6, "0");
}

export namespace AuthService {
  export async function register(data: RegisterInput) {
    const existing = await db.query.usersTable.findFirst({
      where: or(
        eq(usersTable.email, data.email),
        eq(usersTable.username, data.username),
      ),
      columns: { id: true },
    });

    if (existing) {
      throw new Error("EMAIL_OR_USERNAME_TAKEN");
    }

    const passwordHash = await Bun.password.hash(data.password);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: data.email,
        username: data.username,
        passwordHash,
        emailVerified: false,
        globalRole: "user",
      })
      .returning();

    if (!newUser) throw new Error("USER_CREATION_FAILED");

    await sendVerificationCode(newUser.id, newUser.email, "EMAIL_VERIFICATION");

    return { userId: newUser.id };
  }

  export async function login(
    data: LoginInput,
    ipAddress: string,
    userAgent?: string,
  ) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, data.email),
    });

    if (!user || !user.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const isValid = await Bun.password.verify(data.password, user.passwordHash);
    if (!isValid) throw new Error("INVALID_CREDENTIALS");

    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    await checkIpSecurity(user.id, user.email, ipAddress);

    const session = await createSession(user.id, ipAddress, userAgent);

    return {
      session,
      user: { id: user.id, username: user.username, role: user.globalRole },
    };
  }

  export async function verifyCode(
    token: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE",
  ) {
    return await db.transaction(async (tx) => {
      const verification = await tx.query.verificationsTable.findFirst({
        where: and(
          eq(verificationsTable.token, token),
          eq(verificationsTable.type, type),
          gt(verificationsTable.expiresAt, new Date()),
          isNull(verificationsTable.usedAt),
        ),
      });

      if (!verification) {
        throw new Error("INVALID_OR_EXPIRED_CODE");
      }

      await tx
        .update(verificationsTable)
        .set({ usedAt: new Date() })
        .where(eq(verificationsTable.id, verification.id));

      if (type === "EMAIL_VERIFICATION") {
        await tx
          .update(usersTable)
          .set({ emailVerified: true })
          .where(eq(usersTable.id, verification.userId));
      }

      return verification.userId;
    });
  }

  export async function sendVerificationCode(
    userId: string,
    email: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE",
  ) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db
      .update(verificationsTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(verificationsTable.userId, userId),
          eq(verificationsTable.type, type),
          isNull(verificationsTable.usedAt),
        ),
      );

    await db.insert(verificationsTable).values({
      userId,
      token: code,
      type,
      expiresAt,
    });

    await emailService.sendVerificationCode(email, code, type);
  }

  export async function resendVerificationCode(data: ResendVerificationInput) {
    if (data.type === "ACCOUNT_DELETION") {
      throw new Error("UNSUPPORTED_VERIFICATION_TYPE");
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, data.email),
    });

    if (!user) return;

    if (data.type === "EMAIL_VERIFICATION" && user.emailVerified) return;

    if (data.type === "EMAIL_CHANGE") {
      const targetEmail = user.pendingEmail;
      if (!targetEmail) return;
      await sendVerificationCode(user.id, targetEmail, "EMAIL_CHANGE");
      return;
    }

    if (data.type === "PASSWORD_RESET") {
      await sendVerificationCode(user.id, user.email, "PASSWORD_RESET");
      return;
    }

    await sendVerificationCode(user.id, user.email, "EMAIL_VERIFICATION");
  }

  export async function createSession(
    userId: string,
    ipAddress: string,
    userAgent?: string,
  ) {
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 jours

    await db.insert(sessionsTable).values({
      userId,
      sessionToken,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return { sessionToken, expiresAt };
  }

  export async function logout(sessionToken: string) {
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.sessionToken, sessionToken));
  }

  export async function getSessionUser(sessionToken: string) {
    const result = await db
      .select({
        user: usersTable,
        session: sessionsTable,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(
        and(
          eq(sessionsTable.sessionToken, sessionToken),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  async function checkIpSecurity(
    userId: string,
    email: string,
    ipAddress: string,
  ) {
    const knownIp = await db.query.sessionsTable.findFirst({
      where: and(
        eq(sessionsTable.userId, userId),
        eq(sessionsTable.ipAddress, ipAddress),
      ),
      columns: { id: true },
    });

    if (!knownIp) {
      const hasHistory = await db.query.sessionsTable.findFirst({
        where: eq(sessionsTable.userId, userId),
        columns: { id: true },
      });

      if (hasHistory) {
        emailService
          .sendNewIpNotification(email, ipAddress)
          .catch(console.error);
      }
    }
  }
}

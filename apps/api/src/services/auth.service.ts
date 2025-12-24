import db from "@workspaces/database";
import { usersTable } from "@workspaces/database/schema";
import type {
  LoginInput,
  RegisterInput,
  RequestEmailChangeInput,
  RequestPasswordResetInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SessionMetadataInput,
} from "@workspaces/shared";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth-utils";
import { emailService } from "../lib/email";
import { SessionService } from "./session.service";
import { VerificationService } from "./verification.service";

export namespace AuthService {
  export async function register(
    data: RegisterInput,
    metadata: SessionMetadataInput,
  ) {
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

    const passwordHash = await hashPassword(data.password);
    const country = metadata.location?.countryCode ?? null;
    const timezone = metadata.location?.timezone ?? "UTC";

    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: data.email,
        username: data.username,
        passwordHash,
        country,
        timezone,
        locale: "en-US",
        emailVerified: false,
        globalRole: "user",
      })
      .returning();

    if (!newUser) throw new Error("USER_CREATION_FAILED");

    await VerificationService.sendCode(
      newUser.id,
      newUser.email,
      "EMAIL_VERIFICATION",
    );

    return { userId: newUser.id };
  }

  export async function login(
    data: LoginInput,
    metadata: SessionMetadataInput,
  ) {
    const user = await db.query.usersTable.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.email, data.email), isNull(table.deletedAt)),
    });

    if (!user || !user.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) throw new Error("INVALID_CREDENTIALS");

    if (!user.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    await checkIpSecurity(user.id, user.email, metadata, user.timezone);

    const session = await SessionService.createSession(user.id, metadata);

    return {
      session,
      user: { id: user.id, username: user.username, role: user.globalRole },
    };
  }

  export async function verifyEmail(token: string, email: string) {
    const userId = await VerificationService.verifyCode(
      token,
      email,
      "EMAIL_VERIFICATION",
    );

    await db
      .update(usersTable)
      .set({ emailVerified: true })
      .where(eq(usersTable.id, userId));

    return userId;
  }

  export async function resendVerificationCode(data: ResendVerificationInput) {
    const user = await db.query.usersTable.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.email, data.email), isNull(table.deletedAt)),
    });

    if (!user) return;

    if (data.type === "EMAIL_VERIFICATION" && user.emailVerified) return;

    if (data.type === "EMAIL_CHANGE") {
      const targetEmail = user.pendingEmail;
      if (!targetEmail) return;
      await VerificationService.sendCode(user.id, targetEmail, "EMAIL_CHANGE");
      return;
    }

    if (data.type === "ACCOUNT_DELETION") {
      await VerificationService.sendCode(
        user.id,
        user.email,
        "ACCOUNT_DELETION",
      );
      return;
    }

    await VerificationService.sendCode(user.id, user.email, data.type);
  }

  export async function requestPasswordReset(data: RequestPasswordResetInput) {
    const user = await db.query.usersTable.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.email, data.email), isNull(table.deletedAt)),
    });

    if (!user) return;

    await VerificationService.sendCode(user.id, user.email, "PASSWORD_RESET");
  }

  export async function resetPassword(data: ResetPasswordInput) {
    const userId = await VerificationService.verifyCode(
      data.token,
      data.email,
      "PASSWORD_RESET",
    );

    const passwordHash = await hashPassword(data.newPassword);

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, userId));

      await SessionService.revokeAllUserSessions(userId);
    });
  }

  export async function requestEmailChange(
    userId: string,
    data: RequestEmailChangeInput,
  ) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user || !user.passwordHash) throw new Error("USER_NOT_FOUND");

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) throw new Error("INVALID_PASSWORD");

    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, data.newEmail),
    });

    if (existing) throw new Error("EMAIL_TAKEN");

    await db
      .update(usersTable)
      .set({ pendingEmail: data.newEmail })
      .where(eq(usersTable.id, userId));

    await VerificationService.sendCode(userId, data.newEmail, "EMAIL_CHANGE");
  }

  export async function confirmEmailChange(token: string, newEmail: string) {
    const userId = await VerificationService.verifyCode(
      token,
      newEmail,
      "EMAIL_CHANGE",
    );

    await db
      .update(usersTable)
      .set({
        email: newEmail,
        pendingEmail: null,
        emailVerified: true,
      })
      .where(eq(usersTable.id, userId));
  }

  export async function requestAccountDeletion(
    userId: string,
    password: string,
  ) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user || !user.passwordHash) throw new Error("USER_NOT_FOUND");

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) throw new Error("INVALID_PASSWORD");

    await VerificationService.sendCode(user.id, user.email, "ACCOUNT_DELETION");
  }

  export async function confirmAccountDeletion(token: string, email: string) {
    const userId = await VerificationService.verifyCode(
      token,
      email,
      "ACCOUNT_DELETION",
    );

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ deletedAt: new Date() })
        .where(eq(usersTable.id, userId));

      await SessionService.revokeAllUserSessions(userId);
    });
  }

  export async function logout(sessionToken: string) {
    await SessionService.revokeSession(sessionToken);
  }

  export async function getSessionUser(sessionToken: string) {
    return SessionService.getSessionUser(sessionToken);
  }

  async function checkIpSecurity(
    userId: string,
    email: string,
    metadata: SessionMetadataInput,
    timezone: string,
  ) {
    const ipAddress = metadata.ipAddress ?? "unknown";

    const knownIp = await SessionService.hasVisitedFromIp(userId, ipAddress);

    if (!knownIp) {
      const hasHistory = await SessionService.hasAnySessionHistory(userId);

      if (hasHistory) {
        emailService
          .sendNewIpNotification(email, metadata, timezone)
          .catch(console.error);
      }
    }
  }
}

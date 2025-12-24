import db from "@workspaces/database";
import { usersTable } from "@workspaces/database/schema";
import type {
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
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
      where: eq(usersTable.email, data.email),
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

  export async function verifyCode(
    token: string,
    email: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE",
  ) {
    const userId = await VerificationService.verifyCode(token, email, type);

    if (type === "EMAIL_VERIFICATION") {
      await db
        .update(usersTable)
        .set({ emailVerified: true })
        .where(eq(usersTable.id, userId));
    }

    return userId;
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
      await VerificationService.sendCode(user.id, targetEmail, "EMAIL_CHANGE");
      return;
    }

    await VerificationService.sendCode(user.id, user.email, data.type);
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

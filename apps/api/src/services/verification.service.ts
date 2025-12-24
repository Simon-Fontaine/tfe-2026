import db from "@workspaces/database";
import { usersTable, verificationsTable } from "@workspaces/database/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { generateVerificationCode } from "../lib/auth-utils";
import { emailService } from "../lib/email";

export namespace VerificationService {
  export async function sendCode(
    userId: string,
    email: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE",
  ) {
    const code = generateVerificationCode();
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

  export async function verifyCode(
    token: string,
    email: string,
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE",
  ): Promise<string> {
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

      const user = await tx.query.usersTable.findFirst({
        where: eq(usersTable.id, verification.userId),
        columns: { email: true },
      });

      if (!user || user.email !== email) {
        throw new Error("INVALID_CODE_FOR_EMAIL");
      }

      await tx
        .update(verificationsTable)
        .set({ usedAt: new Date() })
        .where(eq(verificationsTable.id, verification.id));

      return verification.userId;
    });
  }
}

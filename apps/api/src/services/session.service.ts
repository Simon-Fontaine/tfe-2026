import db from "@workspaces/database";
import { sessionsTable, usersTable } from "@workspaces/database/schema";
import type { SessionMetadataInput } from "@workspaces/shared";
import { and, eq, gt, isNull } from "drizzle-orm";

export namespace SessionService {
  export async function createSession(
    userId: string,
    metadata: SessionMetadataInput,
  ) {
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await db.insert(sessionsTable).values({
      userId,
      sessionToken,
      expiresAt,
      ipAddress: metadata.ipAddress,
      location: metadata.location,
      device: metadata.device,
      userAgent: metadata.userAgent,
    });

    return { sessionToken, expiresAt };
  }

  export async function revokeSession(sessionToken: string) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
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
          isNull(sessionsTable.revokedAt),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  export async function revokeAllUserSessions(userId: string) {
    await db
      .update(sessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessionsTable.userId, userId), isNull(sessionsTable.revokedAt)),
      );
  }

  export async function hasVisitedFromIp(userId: string, ipAddress: string) {
    const existing = await db.query.sessionsTable.findFirst({
      where: and(
        eq(sessionsTable.userId, userId),
        eq(sessionsTable.ipAddress, ipAddress),
      ),
      columns: { id: true },
    });
    return !!existing;
  }

  export async function hasAnySessionHistory(userId: string) {
    const history = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.userId, userId),
      columns: { id: true },
    });
    return !!history;
  }
}

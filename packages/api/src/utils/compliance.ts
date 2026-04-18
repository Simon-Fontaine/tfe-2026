import { and, eq, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { accountDeletionRequestTable, sessionTable, userTable } from "@/db/schema";
import logger from "@/utils/logger";

export async function deleteExpiredSessions(now = new Date()) {
	const deleted = await db
		.delete(sessionTable)
		.where(lt(sessionTable.expiresAt, now))
		.returning({ id: sessionTable.id });

	return deleted.length;
}

export async function purgeScheduledAccountDeletions(now = new Date()) {
	const dueRequests = await db
		.select({
			id: accountDeletionRequestTable.id,
			userId: accountDeletionRequestTable.userId,
		})
		.from(accountDeletionRequestTable)
		.where(
			and(
				isNotNull(accountDeletionRequestTable.confirmedAt),
				isNotNull(accountDeletionRequestTable.scheduledDeletionAt),
				isNull(accountDeletionRequestTable.cancelledAt),
				lte(accountDeletionRequestTable.scheduledDeletionAt, now)
			)
		);

	let deletedUserCount = 0;
	const failedUserIds: string[] = [];

	for (const request of dueRequests) {
		try {
			const deletedUsers = await db.transaction(async (tx) => {
				await tx
					.update(sessionTable)
					.set({
						revokedAt: now,
						revocationReason: "account_deletion",
					})
					.where(and(eq(sessionTable.userId, request.userId), isNull(sessionTable.revokedAt)));

				return tx
					.delete(userTable)
					.where(eq(userTable.id, request.userId))
					.returning({ id: userTable.id });
			});

			deletedUserCount += deletedUsers.length;
		} catch (error) {
			failedUserIds.push(request.userId);
			logger.error(
				{ error, userId: request.userId, deletionRequestId: request.id },
				"Failed to purge scheduled account deletion."
			);
		}
	}

	return {
		dueRequestCount: dueRequests.length,
		deletedUserCount,
		failedUserIds,
	};
}

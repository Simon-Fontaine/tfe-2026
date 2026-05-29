import { and, eq, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import { db } from "@/db";
import {
	accountDeletionRequestTable,
	passkeyCredentialTable,
	playerProfileTable,
	securityKeyCredentialTable,
	sensitiveActionVerificationTable,
	sessionTable,
	totpCredentialTable,
	userTable,
} from "@/db/schema";
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
		.innerJoin(userTable, eq(accountDeletionRequestTable.userId, userTable.id))
		.where(
			and(
				isNotNull(accountDeletionRequestTable.confirmedAt),
				isNotNull(accountDeletionRequestTable.scheduledDeletionAt),
				isNull(accountDeletionRequestTable.cancelledAt),
				lte(accountDeletionRequestTable.scheduledDeletionAt, now),
				eq(userTable.isAnonymized, false)
			)
		);

	let anonymizedUserCount = 0;
	const failedUserIds: string[] = [];

	for (const request of dueRequests) {
		try {
			const anonymizedAt = new Date();

			await db.transaction(async (tx) => {
				// Revoke active sessions
				await tx
					.update(sessionTable)
					.set({ revokedAt: now, revocationReason: "account_deletion" })
					.where(and(eq(sessionTable.userId, request.userId), isNull(sessionTable.revokedAt)));

				// Delete auth credentials
				await tx.delete(totpCredentialTable).where(eq(totpCredentialTable.userId, request.userId));
				await tx
					.delete(passkeyCredentialTable)
					.where(eq(passkeyCredentialTable.userId, request.userId));
				await tx
					.delete(securityKeyCredentialTable)
					.where(eq(securityKeyCredentialTable.userId, request.userId));
				await tx
					.delete(sensitiveActionVerificationTable)
					.where(eq(sensitiveActionVerificationTable.userId, request.userId));

				// Delete player profile (contains PII: battletag, bio, etc.)
				await tx.delete(playerProfileTable).where(eq(playerProfileTable.userId, request.userId));

				// Anonymize user row instead of hard-deleting — preserves operational record linkage
				await tx
					.update(userTable)
					.set({
						email: `deleted-${request.userId}@deleted.internal`,
						username: `deleted-${request.userId}`,
						displayName: "Deleted User",
						bio: null,
						avatarUrl: null,
						bannerUrl: null,
						socialLinks: {},
						passwordHash: null,
						recoveryCode: null,
						notificationPreferences: {},
						isAnonymized: true,
						anonymizedAt,
					})
					.where(eq(userTable.id, request.userId));
			});

			anonymizedUserCount += 1;

			writeDomainAuditEvent({
				actorId: null,
				actorType: "system",
				domain: "data_lifecycle",
				actionType: "lifecycle_archived",
				targetType: "user",
				targetId: request.userId,
				outcome: "success",
				metadata: { anonymizedAt: anonymizedAt.toISOString() },
			}).catch((err: unknown) =>
				logger.error(
					{ err, userId: request.userId },
					"Failed to write lifecycle_archived audit event"
				)
			);
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
		deletedUserCount: anonymizedUserCount,
		failedUserIds,
	};
}

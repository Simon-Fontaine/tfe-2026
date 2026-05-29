import { type GovernanceHold, type GovernanceHoldDetail, rateLimits } from "@scrimflow/shared";
import { and, count, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { writeAuditLog } from "@/auth/audit";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import {
	createSensitiveActionVerification,
	deleteSensitiveActionVerification,
	validateAndConsumeSensitiveAction,
} from "@/auth/sensitive-action";
import { db } from "@/db";
import {
	accountDeletionRequestTable,
	organizationMemberTable,
	organizationTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import { sendMail } from "@/email/mailer";
import { VerificationEmail } from "@/email/templates/VerificationEmail";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { createNotification } from "@/notifications";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import logger from "@/utils/logger";

async function getUserGovernanceHold(userId: string): Promise<GovernanceHold> {
	const holdDetails: GovernanceHoldDetail[] = [];

	// Check sole team admin (permissionRole = "admin")
	const adminTeams = await db
		.select({ teamId: teamRosterTable.teamId, teamName: teamTable.name })
		.from(teamRosterTable)
		.innerJoin(teamTable, eq(teamRosterTable.teamId, teamTable.id))
		.where(
			and(
				eq(teamRosterTable.userId, userId),
				eq(teamRosterTable.permissionRole, "admin"),
				eq(teamRosterTable.status, "active")
			)
		);

	for (const { teamId, teamName } of adminTeams) {
		const [{ otherAdmins }] = await db
			.select({ otherAdmins: count() })
			.from(teamRosterTable)
			.where(
				and(
					eq(teamRosterTable.teamId, teamId),
					eq(teamRosterTable.permissionRole, "admin"),
					eq(teamRosterTable.status, "active"),
					ne(teamRosterTable.userId, userId)
				)
			);
		if (Number(otherAdmins) === 0) {
			holdDetails.push({ entityType: "team", entityId: teamId, entityName: teamName });
		}
	}

	// Check sole org owner (role = "owner")
	const ownerOrgs = await db
		.select({
			orgId: organizationMemberTable.organizationId,
			orgName: organizationTable.name,
		})
		.from(organizationMemberTable)
		.innerJoin(organizationTable, eq(organizationMemberTable.organizationId, organizationTable.id))
		.where(
			and(eq(organizationMemberTable.userId, userId), eq(organizationMemberTable.role, "owner"))
		);

	for (const { orgId, orgName } of ownerOrgs) {
		const [{ otherOwners }] = await db
			.select({ otherOwners: count() })
			.from(organizationMemberTable)
			.where(
				and(
					eq(organizationMemberTable.organizationId, orgId),
					eq(organizationMemberTable.role, "owner"),
					ne(organizationMemberTable.userId, userId)
				)
			);
		if (Number(otherOwners) === 0) {
			holdDetails.push({ entityType: "organization", entityId: orgId, entityName: orgName });
		}
	}

	return { blocked: holdDetails.length > 0, holdDetails };
}

const DELETION_GRACE_PERIOD_MS = 1_000 * 60 * 60 * 24 * 30; // 30 days

const accountRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET /deletion — Get account deletion status
accountRoutes.get("/deletion", async (c) => {
	const session = c.get("session");

	const [record, governanceHold] = await Promise.all([
		db
			.select({
				scheduledDeletionAt: accountDeletionRequestTable.scheduledDeletionAt,
				cancelledAt: accountDeletionRequestTable.cancelledAt,
				confirmedAt: accountDeletionRequestTable.confirmedAt,
			})
			.from(accountDeletionRequestTable)
			.where(eq(accountDeletionRequestTable.userId, session.userId))
			.orderBy(desc(accountDeletionRequestTable.createdAt))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		getUserGovernanceHold(session.userId).catch(() => ({
			blocked: false,
			holdDetails: [] as GovernanceHoldDetail[],
		})),
	]);

	const now = new Date();
	const isPending = Boolean(
		record?.scheduledDeletionAt && !record.cancelledAt && record.scheduledDeletionAt > now
	);
	const isExpired = Boolean(
		record?.scheduledDeletionAt && !record.cancelledAt && record.scheduledDeletionAt <= now
	);

	return c.json({
		data: {
			status: isPending
				? "pending"
				: record?.cancelledAt
					? "cancelled"
					: isExpired
						? "failed"
						: "none",
			isPending,
			scheduledAt: record?.scheduledDeletionAt?.toISOString() ?? null,
			cancelledAt: record?.cancelledAt?.toISOString() ?? null,
			failedAt: isExpired ? (record?.scheduledDeletionAt?.toISOString() ?? null) : null,
			governanceHold,
		},
	});
});

// POST /deletion/request — Request account deletion
accountRoutes.post("/deletion/request", async (c) => {
	const session = c.get("session");
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`account-deletion-request:${session.userId}`,
		rateLimits.sensitiveActionRequest.limit,
		rateLimits.sensitiveActionRequest.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ reason?: string }>().catch((): { reason?: string } => ({}));

	const client = c.get("client");
	const code = await createSensitiveActionVerification(
		session.userId,
		"account_deletion",
		{ reason: body.reason ?? null },
		client.ip
	);

	await sendMail({
		to: user.email,
		subject: "Confirm account deletion",
		template: (
			<VerificationEmail
				code={code}
				title="Confirm your account deletion"
				message="You requested to permanently delete your Scrimflow account. This action cannot be undone. If you did not request this, you can safely ignore this email."
				actionText="enter the following confirmation code"
			/>
		),
	});

	writeAuditLog(
		session.userId,
		"account_deletion_request",
		client.ip,
		client.userAgent,
		null,
		null,
		{
			reason: body.reason ?? null,
		}
	);

	createNotification({
		userId: session.userId,
		type: "account_deletion_requested",
		title: "Account deletion requested",
		body: "Check your email to confirm. Deletion is pending until confirmed.",
	}).catch((err: unknown) => logger.error({ err }, "account deletion notification failed"));

	return c.json({ success: true });
});

// POST /deletion/confirm — Confirm account deletion
accountRoutes.post("/deletion/confirm", async (c) => {
	const session = c.get("session");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`account-deletion-verify:${session.userId}`,
		rateLimits.sensitiveActionVerify.limit,
		rateLimits.sensitiveActionVerify.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: `Too many attempts. Please wait ${formatRetryAfter(retryAfterMs)} before trying again.`,
			},
			429
		);
	}

	const body = await c.req.json<{ code: string }>().catch(() => null);
	if (!body?.code) return c.json({ error: "Code is required." }, 400);

	const hold = await getUserGovernanceHold(session.userId);
	if (hold.blocked) {
		return c.json(
			{
				error: "You must transfer ownership before deleting your account.",
				reason: "ownership_block",
				holdDetails: hold.holdDetails,
			},
			409
		);
	}

	const result = await validateAndConsumeSensitiveAction(
		session.userId,
		"account_deletion",
		body.code
	);
	if (!result.success) return c.json({ error: "Invalid or expired verification code." }, 400);

	// Re-check hold after consuming the code to close the TOCTOU window
	const finalHold = await getUserGovernanceHold(session.userId);
	if (finalHold.blocked) {
		return c.json(
			{
				error: "You must transfer ownership before deleting your account.",
				reason: "ownership_block",
				holdDetails: finalHold.holdDetails,
			},
			409
		);
	}

	const reason = typeof result.metadata?.reason === "string" ? result.metadata.reason : null;
	const scheduledDeletionAt = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);

	await db.insert(accountDeletionRequestTable).values({
		userId: session.userId,
		code: body.code,
		reason,
		expiresAt: new Date(),
		confirmedAt: new Date(),
		scheduledDeletionAt,
		ipAddress: null,
	});

	await deleteSensitiveActionVerification(session.userId, "account_deletion");

	const client = c.get("client");
	writeAuditLog(
		session.userId,
		"account_deletion_confirm",
		client.ip,
		client.userAgent,
		null,
		null,
		{
			scheduledDeletionAt: scheduledDeletionAt.toISOString(),
		}
	);
	writeDomainAuditEvent({
		actorId: session.userId,
		actorType: "user",
		domain: "data_lifecycle",
		actionType: "account_deletion_confirmed",
		targetType: "user",
		targetId: session.userId,
		outcome: "success",
	});

	return c.json({ success: true });
});

// DELETE /deletion — Cancel account deletion
accountRoutes.delete("/deletion", async (c) => {
	const session = c.get("session");

	const updated = await db
		.update(accountDeletionRequestTable)
		.set({ cancelledAt: new Date() })
		.where(
			and(
				eq(accountDeletionRequestTable.userId, session.userId),
				isNull(accountDeletionRequestTable.cancelledAt),
				gt(accountDeletionRequestTable.scheduledDeletionAt, new Date())
			)
		)
		.returning({ id: accountDeletionRequestTable.id });

	if (updated.length === 0) return c.json({ error: "No pending deletion request found." }, 404);

	const client = c.get("client");
	writeAuditLog(
		session.userId,
		"account_deletion_cancel",
		client.ip,
		client.userAgent,
		null,
		null,
		undefined
	);

	return c.json({ success: true });
});

export { accountRoutes };

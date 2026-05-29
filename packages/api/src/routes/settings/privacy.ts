import {
	type AccountLifecycleState,
	type PersonalPrivacySettings,
	PersonalPrivacySettingsSchema,
	rateLimits,
} from "@scrimflow/shared";
import { desc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import * as v from "valibot";
import { writeAuditLog } from "@/auth/audit";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import { db } from "@/db";
import {
	accountDeletionRequestTable,
	organizationMemberTable,
	organizationTable,
	playerProfileTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	teamRosterTable,
	teamTable,
	userTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { extractErrors } from "@/routes/auth/utils";

const DEFAULT_PRIVACY_SETTINGS: PersonalPrivacySettings = {
	profileVisibility: "public",
	availabilityVisibility: "public",
	recruitingDiscoverability: true,
	publicHistoryVisibility: "public",
};

const privacyRoutes = new Hono<RequestContextEnv & AuthEnv>();

privacyRoutes.get("/", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({
			profileVisibility: playerProfileTable.profileVisibility,
			availabilityVisibility: playerProfileTable.availabilityVisibility,
			recruitingDiscoverability: playerProfileTable.recruitingDiscoverability,
			publicHistoryVisibility: playerProfileTable.publicHistoryVisibility,
		})
		.from(playerProfileTable)
		.where(eq(playerProfileTable.userId, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return c.json({
		data: {
			profileVisibility:
				row?.profileVisibility === "teams_only" || row?.profileVisibility === "private"
					? row.profileVisibility
					: DEFAULT_PRIVACY_SETTINGS.profileVisibility,
			availabilityVisibility:
				row?.availabilityVisibility === "teams_only" || row?.availabilityVisibility === "private"
					? row.availabilityVisibility
					: DEFAULT_PRIVACY_SETTINGS.availabilityVisibility,
			recruitingDiscoverability:
				row?.recruitingDiscoverability ?? DEFAULT_PRIVACY_SETTINGS.recruitingDiscoverability,
			publicHistoryVisibility:
				row?.publicHistoryVisibility === "teams_only" || row?.publicHistoryVisibility === "private"
					? row.publicHistoryVisibility
					: DEFAULT_PRIVACY_SETTINGS.publicHistoryVisibility,
		} satisfies PersonalPrivacySettings,
	});
});

async function updatePrivacySettings(c: Context<RequestContextEnv & AuthEnv>) {
	const session = c.get("session");
	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(PersonalPrivacySettingsSchema, body);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid privacy settings.", fieldErrors: extractErrors(parsed.issues) },
			400
		);
	}
	await db
		.update(playerProfileTable)
		.set({
			profileVisibility: parsed.output.profileVisibility,
			availabilityVisibility: parsed.output.availabilityVisibility,
			recruitingDiscoverability: parsed.output.recruitingDiscoverability,
			publicHistoryVisibility: parsed.output.publicHistoryVisibility,
		})
		.where(eq(playerProfileTable.userId, session.userId));
	return c.json({ success: true });
}

privacyRoutes.put("/", updatePrivacySettings);
privacyRoutes.patch("/", updatePrivacySettings);

export { privacyRoutes };

const dataExportRoute = new Hono<RequestContextEnv & AuthEnv>();

dataExportRoute.get("/status", (c) =>
	c.json({
		data: {
			status: "available",
			mode: "immediate_download",
			requestedAt: null,
			completedAt: null,
			downloadUrl: null,
		},
	})
);

dataExportRoute.get("/", (c) =>
	c.json({
		data: {
			status: "available",
			mode: "immediate_download",
			requestedAt: null,
			completedAt: null,
			downloadUrl: null,
		},
	})
);

dataExportRoute.get("/download", async (c) => {
	const session = c.get("session");
	const { allowed, retryAfterMs } = await checkRateLimit(
		`user:${session.userId}:data_export`,
		rateLimits.dataExport.limit,
		rateLimits.dataExport.windowMs
	);
	if (!allowed) {
		c.header("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
		return c.json(
			{ error: `Rate limit exceeded. Try again in ${formatRetryAfter(retryAfterMs)}.` },
			429
		);
	}
	const [user, profile, teamMemberships, orgMemberships, recruitingApplications] =
		await Promise.all([
			db
				.select({
					id: userTable.id,
					email: userTable.email,
					username: userTable.username,
					displayName: userTable.displayName,
					createdAt: userTable.createdAt,
					notificationPreferences: userTable.notificationPreferences,
				})
				.from(userTable)
				.where(eq(userTable.id, session.userId))
				.limit(1)
				.then((rows) => rows[0] ?? null),
			db
				.select({
					primaryRole: playerProfileTable.primaryRole,
					rank: playerProfileTable.rank,
					battletag: playerProfileTable.battletag,
					profileVisibility: playerProfileTable.profileVisibility,
					availabilityVisibility: playerProfileTable.availabilityVisibility,
					recruitingDiscoverability: playerProfileTable.recruitingDiscoverability,
					publicHistoryVisibility: playerProfileTable.publicHistoryVisibility,
				})
				.from(playerProfileTable)
				.where(eq(playerProfileTable.userId, session.userId))
				.limit(1)
				.then((rows) => rows[0] ?? null),
			db
				.select({
					teamId: teamRosterTable.teamId,
					teamName: teamTable.name,
					role: teamRosterTable.permissionRole,
					memberType: teamRosterTable.memberType,
					joinedAt: teamRosterTable.joinedAt,
				})
				.from(teamRosterTable)
				.innerJoin(teamTable, eq(teamRosterTable.teamId, teamTable.id))
				.where(eq(teamRosterTable.userId, session.userId)),
			db
				.select({
					orgId: organizationMemberTable.organizationId,
					orgName: organizationTable.name,
					role: organizationMemberTable.role,
					joinedAt: organizationMemberTable.createdAt,
				})
				.from(organizationMemberTable)
				.innerJoin(
					organizationTable,
					eq(organizationMemberTable.organizationId, organizationTable.id)
				)
				.where(eq(organizationMemberTable.userId, session.userId)),
			db
				.select({
					listingId: recruitmentApplicationTable.listingId,
					teamId: recruitmentListingTable.teamId,
					status: recruitmentApplicationTable.status,
					submittedAt: recruitmentApplicationTable.createdAt,
				})
				.from(recruitmentApplicationTable)
				.innerJoin(
					recruitmentListingTable,
					eq(recruitmentApplicationTable.listingId, recruitmentListingTable.id)
				)
				.where(eq(recruitmentApplicationTable.applicantUserId, session.userId)),
		]);

	if (!user) return c.json({ error: "User not found." }, 404);

	const { notificationPreferences, ...userFields } = user;
	const privacySettings = profile
		? {
				profileVisibility: profile.profileVisibility,
				availabilityVisibility: profile.availabilityVisibility,
				recruitingDiscoverability: profile.recruitingDiscoverability,
				publicHistoryVisibility: profile.publicHistoryVisibility,
			}
		: null;

	const exportData = {
		exportedAt: new Date().toISOString(),
		user: userFields,
		profile: profile
			? {
					primaryRole: profile.primaryRole,
					rank: profile.rank,
					battletag: profile.battletag,
				}
			: null,
		privacySettings,
		notificationPreferences: notificationPreferences ?? {},
		teamMemberships: teamMemberships.map((m) => ({
			...m,
			joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
		})),
		orgMemberships: orgMemberships.map((m) => ({
			...m,
			joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
		})),
		recruitingApplications: recruitingApplications.map((a) => ({
			...a,
			submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
		})),
	};

	const client = c.get("client");
	writeAuditLog(session.userId, "data_export_request", client.ip, client.userAgent, null, null, {
		mode: "immediate_download",
	});
	writeDomainAuditEvent({
		actorId: session.userId,
		actorType: "user",
		domain: "data_lifecycle",
		actionType: "data_export_requested",
		targetType: "user",
		targetId: session.userId,
		outcome: "success",
	});
	c.header("Content-Type", "application/json");
	c.header("Content-Disposition", 'attachment; filename="scrimflow-data-export.json"');
	return c.body(JSON.stringify(exportData, null, 2));
});

export { dataExportRoute };

export async function getAccountLifecycleState(userId: string): Promise<AccountLifecycleState> {
	const deletion = await db
		.select({
			scheduledDeletionAt: accountDeletionRequestTable.scheduledDeletionAt,
			cancelledAt: accountDeletionRequestTable.cancelledAt,
		})
		.from(accountDeletionRequestTable)
		.where(eq(accountDeletionRequestTable.userId, userId))
		.orderBy(desc(accountDeletionRequestTable.createdAt))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	const now = new Date();
	const isPending = Boolean(
		deletion?.scheduledDeletionAt && !deletion.cancelledAt && deletion.scheduledDeletionAt > now
	);
	const isExpired = Boolean(
		deletion?.scheduledDeletionAt && !deletion.cancelledAt && deletion.scheduledDeletionAt <= now
	);
	return {
		deletion: {
			status: isPending
				? "pending"
				: deletion?.cancelledAt
					? "cancelled"
					: isExpired
						? "failed"
						: "none",
			isPending,
			scheduledAt: deletion?.scheduledDeletionAt?.toISOString() ?? null,
			cancelledAt: deletion?.cancelledAt?.toISOString() ?? null,
			failedAt: isExpired ? (deletion?.scheduledDeletionAt?.toISOString() ?? null) : null,
		},
		dataExport: {
			status: "available",
			mode: "immediate_download",
			requestedAt: null,
			completedAt: null,
			downloadUrl: null,
		},
		governanceHold: null,
	};
}

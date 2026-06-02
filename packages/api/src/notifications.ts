import { appRoutes, type NotificationSummary } from "@scrimflow/shared";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	chatChannelTable,
	notificationTable,
	type notificationTypeEnum,
	ocrJobTable,
	scrimTable,
	updatePostTable,
	userTable,
} from "@/db/schema";
import { publishUserRealtimeEvent } from "@/realtime/scrim-hub";
import { isUserOnTeam } from "@/utils/team";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type OptionalNotificationCategory =
	| "invites"
	| "applications"
	| "scrimChanges"
	| "chatActivity"
	| "results"
	| "disputes"
	| "updates";

const OPTIONAL_NOTIFICATION_BY_TYPE: Partial<
	Record<NotificationType, OptionalNotificationCategory>
> = {
	channel_invite: "invites",
	team_invite_received: "invites",
	team_invite_accepted: "invites",
	org_invite_received: "invites",
	recruitment_application: "applications",
	recruitment_accepted: "applications",
	recruitment_rejected: "applications",
	recruitment_withdrawn: "applications",
	scrim_request: "scrimChanges",
	scrim_accepted: "scrimChanges",
	scrim_cancelled: "scrimChanges",
	scrim_reminder: "scrimChanges",
	scrim_rescheduled: "scrimChanges",
	scrim_started: "scrimChanges",
	ocr_completed: "results",
	ocr_failed: "results",
	scrim_result_reported: "results",
	sr_updated: "results",
	scrim_disputed: "disputes",
	scrim_resolved: "disputes",
	dispute_opened: "disputes",
	dispute_resolved: "disputes",
	new_message: "chatActivity",
	generic: "updates",
};

const MANDATORY_NOTIFICATION_TYPES = new Set<NotificationType>([
	"email_change_requested",
	"account_deletion_requested",
	"new_device_login",
	"new_location_login",
	"session_revoked_alert",
]);

interface CreateNotificationInput {
	userId: string;
	type: NotificationType;
	title: string;
	body?: string;
	referenceType?: string;
	referenceId?: string;
	/**
	 * Dedup-index conflict handling: omitted = discard duplicate; 'refresh' = bump
	 * `createdAt` (resend flows); 'always-insert' = no conflict clause, for when one
	 * referenceId spans distinct events (e.g. ownership workflow transitions).
	 */
	conflictBehavior?: "refresh" | "always-insert";
}

type NotificationRow = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	referenceType: string | null;
	referenceId: string | null;
	isRead: boolean;
	isDismissed: boolean;
	createdAt: Date;
};

async function resolveParticipantTeamId(
	userId: string,
	scrim: { homeTeamId: string; awayTeamId: string | null }
) {
	if (await isUserOnTeam(userId, scrim.homeTeamId)) return scrim.homeTeamId;
	if (scrim.awayTeamId && (await isUserOnTeam(userId, scrim.awayTeamId))) return scrim.awayTeamId;
	return null;
}

async function resolveNotificationDestinationHref(row: NotificationRow, userId: string) {
	if (row.referenceType === "team_invite") {
		return appRoutes.invites;
	}

	if (row.referenceType === "org_invite") {
		return appRoutes.invites;
	}

	if (row.referenceType === "recruitment_listing") {
		return appRoutes.recruiting.root;
	}

	if (row.referenceType === "recruitment_application") {
		return appRoutes.recruiting.conversations;
	}

	if (!row.referenceId) return null;

	if (row.referenceType === "update_post") {
		const update = await db.query.updatePostTable.findFirst({
			where: eq(updatePostTable.id, row.referenceId),
			columns: { id: true, teamId: true, organizationId: true },
		});
		if (!update) return appRoutes.inbox;
		if (update.teamId) return appRoutes.teams.updates(update.teamId);
		if (update.organizationId) return appRoutes.orgs.updates(update.organizationId);
		return appRoutes.inbox;
	}

	if (row.referenceType === "scrim") {
		const scrim = await db.query.scrimTable.findFirst({
			where: eq(scrimTable.id, row.referenceId),
			columns: { id: true, homeTeamId: true, awayTeamId: true },
		});
		if (!scrim) return appRoutes.inbox;
		const teamId = await resolveParticipantTeamId(userId, scrim);
		return teamId ? appRoutes.teams.scrimById(teamId, scrim.id) : appRoutes.inbox;
	}

	if (row.referenceType === "ocr_job") {
		const job = await db.query.ocrJobTable.findFirst({
			where: eq(ocrJobTable.id, row.referenceId),
			columns: { id: true, scrimId: true },
		});
		if (!job) return appRoutes.inbox;
		const scrim = await db.query.scrimTable.findFirst({
			where: eq(scrimTable.id, job.scrimId),
			columns: { id: true, homeTeamId: true, awayTeamId: true },
		});
		if (!scrim) return appRoutes.inbox;
		const teamId = await resolveParticipantTeamId(userId, scrim);
		return teamId ? appRoutes.teams.scrimById(teamId, scrim.id) : appRoutes.inbox;
	}

	if (row.referenceType === "chat_channel") {
		const channel = await db.query.chatChannelTable.findFirst({
			where: eq(chatChannelTable.id, row.referenceId),
			columns: { id: true, channelType: true, teamId: true, scrimId: true },
		});
		if (!channel) return appRoutes.inbox;

		if (channel.channelType === "recruitment") {
			return `${appRoutes.recruiting.conversations}?conversation=${row.referenceId}`;
		}

		if (channel.channelType === "team" && channel.teamId) {
			return `${appRoutes.teams.chat(channel.teamId)}?conversation=${row.referenceId}`;
		}

		if (
			(channel.channelType === "scrim_lobby" || channel.channelType === "scrim_negotiation") &&
			channel.scrimId
		) {
			const scrim = await db.query.scrimTable.findFirst({
				where: eq(scrimTable.id, channel.scrimId),
				columns: { id: true, homeTeamId: true, awayTeamId: true },
			});
			if (!scrim) return appRoutes.inbox;
			const teamId = await resolveParticipantTeamId(userId, scrim);
			return teamId
				? `${appRoutes.teams.chat(teamId)}?conversation=${row.referenceId}`
				: appRoutes.inbox;
		}

		return appRoutes.inbox;
	}

	return null;
}

export async function mapNotification(
	row: NotificationRow,
	userId: string
): Promise<NotificationSummary> {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		body: row.body,
		referenceType: row.referenceType,
		referenceId: row.referenceId,
		destinationHref: await resolveNotificationDestinationHref(row, userId),
		isRead: row.isRead,
		isDismissed: row.isDismissed,
		createdAt: row.createdAt.toISOString(),
	};
}

/**
 * Mark a user's unread `new_message` notifications for a conversation as read and
 * publish `notification:read` so the inbox badge clears the moment they open the
 * chat (rather than lingering at "1" while they're reading it).
 */
export async function markChatChannelNotificationsRead(
	userId: string,
	conversationId: string
): Promise<void> {
	const updated = await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(
			and(
				eq(notificationTable.userId, userId),
				eq(notificationTable.referenceType, "chat_channel"),
				eq(notificationTable.referenceId, conversationId),
				eq(notificationTable.isRead, false),
				eq(notificationTable.isDismissed, false)
			)
		)
		.returning({ id: notificationTable.id });

	if (updated.length === 0) return;

	const unreadCount = await getUnreadNotificationCount(userId);
	for (const row of updated) {
		publishUserRealtimeEvent({
			userId,
			event: "notification:read",
			payload: { notificationId: row.id, unreadCount },
		});
	}
}

async function getUnreadNotificationCount(userId: string) {
	const [result] = await db
		.select({ count: count() })
		.from(notificationTable)
		.where(
			and(
				eq(notificationTable.userId, userId),
				eq(notificationTable.isRead, false),
				eq(notificationTable.isDismissed, false)
			)
		);

	return Number(result?.count ?? 0);
}

async function isNotificationAllowed(userId: string, type: NotificationType, client: typeof db) {
	if (MANDATORY_NOTIFICATION_TYPES.has(type)) return true;
	const category = OPTIONAL_NOTIFICATION_BY_TYPE[type];
	if (!category) return true;

	const row = await client
		.select({ notificationPreferences: userTable.notificationPreferences })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return row?.notificationPreferences?.[category] !== false;
}

/**
 * Insert a single notification row. Call from within Server Actions after
 * a mutation that should notify a user. Pass a transaction `tx` when called
 * inside a `db.transaction()` block.
 */
export async function createNotification(
	input: CreateNotificationInput,
	tx?: typeof db
): Promise<NotificationSummary | null> {
	const client = tx ?? db;
	if (!(await isNotificationAllowed(input.userId, input.type, client))) return null;

	const values = {
		userId: input.userId,
		type: input.type,
		title: input.title,
		body: input.body,
		referenceType: input.referenceType,
		referenceId: input.referenceId,
	};
	const returning = {
		id: notificationTable.id,
		type: notificationTable.type,
		title: notificationTable.title,
		body: notificationTable.body,
		referenceType: notificationTable.referenceType,
		referenceId: notificationTable.referenceId,
		isRead: notificationTable.isRead,
		isDismissed: notificationTable.isDismissed,
		createdAt: notificationTable.createdAt,
	};

	const [created] = await (input.conflictBehavior === "refresh"
		? client
				.insert(notificationTable)
				.values(values)
				.onConflictDoUpdate({
					target: [notificationTable.userId, notificationTable.type, notificationTable.referenceId],
					targetWhere: sql`${notificationTable.isRead} = false`,
					set: { createdAt: new Date() },
				})
				.returning(returning)
		: input.conflictBehavior === "always-insert"
			? client.insert(notificationTable).values(values).returning(returning)
			: client.insert(notificationTable).values(values).onConflictDoNothing().returning(returning));

	if (!created) return null;

	const notification = await mapNotification(created, input.userId);

	// Skip realtime fan-out when called inside an explicit transaction. The
	// caller can publish after commit if it needs strict transactional delivery.
	if (!tx) {
		const unreadCount = await getUnreadNotificationCount(input.userId);
		publishUserRealtimeEvent({
			userId: input.userId,
			event: "notification:created",
			payload: {
				notification,
				unreadCount,
			},
		});
	}

	return notification;
}

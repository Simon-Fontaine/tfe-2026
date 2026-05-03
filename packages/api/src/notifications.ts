import { appRoutes, type NotificationSummary } from "@scrimflow/shared";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationTable, type notificationTypeEnum, ocrJobTable, scrimTable } from "@/db/schema";
import { publishUserRealtimeEvent } from "@/realtime/scrim-hub";
import { isUserOnTeam } from "@/utils/team";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

interface CreateNotificationInput {
	userId: string;
	type: NotificationType;
	title: string;
	body?: string;
	referenceType?: string;
	referenceId?: string;
}

type NotificationRow = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	referenceType: string | null;
	referenceId: string | null;
	isRead: boolean;
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
	if (!row.referenceId) return null;

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
		createdAt: row.createdAt.toISOString(),
	};
}

async function getUnreadNotificationCount(userId: string) {
	const [result] = await db
		.select({ count: count() })
		.from(notificationTable)
		.where(and(eq(notificationTable.userId, userId), eq(notificationTable.isRead, false)));

	return Number(result?.count ?? 0);
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
	const [created] = await client
		.insert(notificationTable)
		.values({
			userId: input.userId,
			type: input.type,
			title: input.title,
			body: input.body,
			referenceType: input.referenceType,
			referenceId: input.referenceId,
		})
		.returning({
			id: notificationTable.id,
			type: notificationTable.type,
			title: notificationTable.title,
			body: notificationTable.body,
			referenceType: notificationTable.referenceType,
			referenceId: notificationTable.referenceId,
			isRead: notificationTable.isRead,
			createdAt: notificationTable.createdAt,
		});

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

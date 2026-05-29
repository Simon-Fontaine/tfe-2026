import type {
	ModerationCaseAction,
	ModerationCaseDetail,
	ModerationCaseEvent,
	ModerationQueueItem,
	ModerationUrgencyLevel,
	ReportStatus,
} from "@scrimflow/shared";
import { ModerationCasePatchSchema, ModerationQueueFilterSchema } from "@scrimflow/shared";
import { and, asc, count, desc, eq, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	moderationCaseEventTable,
	userReportSupplementTable,
	userReportTable,
	userTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const moderationRoutes = new Hono<AuthEnv>();

const PAGE_SIZE = 25;

const URGENT_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function computeUrgency(status: ReportStatus, createdAt: Date): ModerationUrgencyLevel {
	if (status === "resolved" || status === "dismissed") return "normal";
	const age = Date.now() - createdAt.getTime();
	if (age >= OVERDUE_THRESHOLD_MS) return "overdue";
	if (age >= URGENT_THRESHOLD_MS) return "urgent";
	return "normal";
}

moderationRoutes.get("/queue", async (c) => {
	const user = c.get("user");
	if (!user.isModerator) {
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);
	}

	const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
	const parsed = v.safeParse(ModerationQueueFilterSchema, rawQuery);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid query parameters.", issues: extractErrors(parsed.issues) },
			400
		);
	}

	const filters = parsed.output;
	const conditions = [];

	if (filters.status) conditions.push(eq(userReportTable.status, filters.status));
	if (filters.category) conditions.push(eq(userReportTable.category, filters.category));
	if (filters.targetType) conditions.push(eq(userReportTable.targetType, filters.targetType));
	if (filters.assignedTo === "me") {
		conditions.push(eq(userReportTable.assignedModeratorId, user.id));
	} else if (filters.assignedTo === "unassigned") {
		conditions.push(isNull(userReportTable.assignedModeratorId));
	}

	// P3: compound cursor encodes both updatedAt and id to avoid skips at page boundaries
	if (filters.cursor) {
		const pipeIdx = filters.cursor.indexOf("|");
		const cursorDateStr = pipeIdx > 0 ? filters.cursor.slice(0, pipeIdx) : filters.cursor;
		const cursorId = pipeIdx > 0 ? filters.cursor.slice(pipeIdx + 1) : undefined;
		const cursorDate = new Date(cursorDateStr);
		if (!Number.isNaN(cursorDate.getTime())) {
			if (cursorId) {
				conditions.push(
					or(
						lt(userReportTable.updatedAt, cursorDate),
						and(eq(userReportTable.updatedAt, cursorDate), lt(userReportTable.id, cursorId))
					)
				);
			} else {
				conditions.push(lt(userReportTable.updatedAt, cursorDate));
			}
		}
	}

	const assignedModerator = alias(userTable, "assigned_moderator");

	const rows = await db
		.select({
			report: userReportTable,
			assignedModeratorName: assignedModerator.displayName,
			supplementCount: count(userReportSupplementTable.id),
		})
		.from(userReportTable)
		.leftJoin(assignedModerator, eq(userReportTable.assignedModeratorId, assignedModerator.id))
		.leftJoin(userReportSupplementTable, eq(userReportTable.id, userReportSupplementTable.reportId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(userReportTable.id, assignedModerator.displayName)
		.orderBy(desc(userReportTable.updatedAt), desc(userReportTable.createdAt))
		.limit(PAGE_SIZE + 1);

	const hasMore = rows.length > PAGE_SIZE;
	const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
	const lastRow = pageRows[pageRows.length - 1];
	const nextCursor = hasMore
		? `${lastRow.report.updatedAt.toISOString()}|${lastRow.report.id}`
		: null;

	const items: ModerationQueueItem[] = pageRows.map((row) => ({
		id: row.report.id,
		category: row.report.category,
		targetType: row.report.targetType,
		targetId: row.report.targetId,
		status: row.report.status,
		assignedModeratorId: row.report.assignedModeratorId ?? null,
		assignedModeratorName: row.assignedModeratorName ?? null,
		createdAt: row.report.createdAt.toISOString(),
		updatedAt: row.report.updatedAt.toISOString(),
		targetSnapshot: (row.report.targetSnapshot as Record<string, unknown> | null) ?? null,
		urgencyLevel: computeUrgency(row.report.status, row.report.createdAt),
		supplementCount: Number(row.supplementCount),
	}));

	return c.json({
		items,
		nextCursor,
		filters: {
			...(filters.status && { status: filters.status }),
			...(filters.category && { category: filters.category }),
			...(filters.targetType && { targetType: filters.targetType }),
			...(filters.assignedTo && { assignedTo: filters.assignedTo }),
		},
	});
});

moderationRoutes.get("/reports/:id", async (c) => {
	const user = c.get("user");
	if (!user.isModerator) {
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);
	}

	const reportId = c.req.param("id");

	const report = await db.query.userReportTable.findFirst({
		where: eq(userReportTable.id, reportId),
	});
	if (!report) return c.json({ error: "Report not found." }, 404);

	const supplements = await db.query.userReportSupplementTable.findMany({
		where: eq(userReportSupplementTable.reportId, reportId),
		orderBy: [asc(userReportSupplementTable.createdAt)],
	});

	// D2: insert "viewed" event first so it appears in the returned timeline
	await db.insert(moderationCaseEventTable).values({
		reportId,
		moderatorId: user.id,
		action: "viewed" as ModerationCaseAction,
	});

	// P7: leftJoin so events for deleted moderators still appear in the timeline
	const eventRows = await db
		.select({
			event: moderationCaseEventTable,
			moderatorName: userTable.displayName,
		})
		.from(moderationCaseEventTable)
		.leftJoin(userTable, eq(moderationCaseEventTable.moderatorId, userTable.id))
		.where(eq(moderationCaseEventTable.reportId, reportId))
		.orderBy(asc(moderationCaseEventTable.createdAt));

	let assignedModeratorName: string | null = null;
	if (report.assignedModeratorId) {
		const mod = await db.query.userTable.findFirst({
			where: eq(userTable.id, report.assignedModeratorId),
			columns: { displayName: true },
		});
		assignedModeratorName = mod?.displayName ?? null;
	}

	const events: ModerationCaseEvent[] = eventRows.map((row) => ({
		id: row.event.id,
		reportId: row.event.reportId,
		moderatorId: row.event.moderatorId,
		moderatorName: row.moderatorName ?? "[deleted]",
		action: row.event.action as ModerationCaseAction,
		metadata: (row.event.metadata as Record<string, unknown> | null) ?? null,
		createdAt: row.event.createdAt.toISOString(),
	}));

	const detail: ModerationCaseDetail = {
		id: report.id,
		category: report.category,
		targetType: report.targetType,
		targetId: report.targetId,
		status: report.status,
		reason: report.reason,
		assignedModeratorId: report.assignedModeratorId ?? null,
		assignedModeratorName,
		assignedAt: report.assignedAt?.toISOString() ?? null,
		resolvedAt: report.resolvedAt?.toISOString() ?? null,
		createdAt: report.createdAt.toISOString(),
		updatedAt: report.updatedAt.toISOString(),
		targetSnapshot: (report.targetSnapshot as Record<string, unknown> | null) ?? null,
		urgencyLevel: computeUrgency(report.status, report.createdAt),
		supplements: supplements.map((s) => ({
			id: s.id,
			authorId: s.authorId ?? null,
			content: s.content,
			createdAt: s.createdAt.toISOString(),
		})),
		events,
	};

	return c.json(detail);
});

moderationRoutes.patch("/reports/:id", async (c) => {
	const user = c.get("user");
	if (!user.isModerator) {
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);
	}

	const reportId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid JSON body." }, 400);

	const parsed = v.safeParse(ModerationCasePatchSchema, body);
	if (!parsed.success) {
		return c.json({ error: "Invalid request body.", issues: extractErrors(parsed.issues) }, 400);
	}

	const report = await db.query.userReportTable.findFirst({
		where: eq(userReportTable.id, reportId),
	});
	if (!report) return c.json({ error: "Report not found." }, 404);

	const input = parsed.output;
	let newStatus = report.status;

	if (input.action === "assign") {
		// D1: self-assign is a no-op
		if (report.assignedModeratorId === user.id) {
			return c.json({ reportId, status: report.status, action: input.action });
		}
		if (report.assignedModeratorId) {
			return c.json(
				{
					error: "Case is already assigned to another moderator.",
					current: { assignedModeratorId: report.assignedModeratorId },
				},
				409
			);
		}
		if (report.status === "pending") newStatus = "under_review";
		// P5: transaction so status update and audit event are atomic
		await db.transaction(async (tx) => {
			await tx
				.update(userReportTable)
				.set({ assignedModeratorId: user.id, assignedAt: new Date(), status: newStatus })
				.where(eq(userReportTable.id, reportId));
			await tx
				.insert(moderationCaseEventTable)
				.values({ reportId, moderatorId: user.id, action: "assigned" });
		});
	} else if (input.action === "unassign") {
		// P4: explicit check for unassigned state before the ownership check
		if (!report.assignedModeratorId) {
			return c.json({ error: "Case is not currently assigned." }, 409);
		}
		if (report.assignedModeratorId !== user.id) {
			return c.json({ error: "You can only unassign cases assigned to you." }, 403);
		}
		await db.transaction(async (tx) => {
			await tx
				.update(userReportTable)
				.set({ assignedModeratorId: null, assignedAt: null })
				.where(eq(userReportTable.id, reportId));
			await tx
				.insert(moderationCaseEventTable)
				.values({ reportId, moderatorId: user.id, action: "unassigned" });
		});
	} else if (input.action === "note") {
		await db.insert(moderationCaseEventTable).values({
			reportId,
			moderatorId: user.id,
			action: "noted",
			metadata: { content: input.content },
		});
	} else if (input.action === "resolve") {
		if (report.status === "resolved" || report.status === "dismissed") {
			return c.json({ error: "Case is already settled." }, 409);
		}
		newStatus = "resolved";
		const now = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(userReportTable)
				.set({ status: "resolved", resolvedAt: now, updatedAt: now })
				.where(eq(userReportTable.id, reportId));
			await tx.insert(moderationCaseEventTable).values({
				reportId,
				moderatorId: user.id,
				action: "resolved",
				metadata: { reason: input.reason },
			});
		});
	} else if (input.action === "dismiss") {
		if (report.status === "resolved" || report.status === "dismissed") {
			return c.json({ error: "Case is already settled." }, 409);
		}
		newStatus = "dismissed";
		const now = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(userReportTable)
				.set({ status: "dismissed", resolvedAt: now, updatedAt: now })
				.where(eq(userReportTable.id, reportId));
			await tx.insert(moderationCaseEventTable).values({
				reportId,
				moderatorId: user.id,
				action: "dismissed",
				metadata: { reason: input.reason },
			});
		});
	}

	// P1: return updated status, not the stale pre-mutation value
	return c.json({ reportId, status: newStatus, action: input.action });
});

export { moderationRoutes };

import type {
	ModerationAction,
	ModerationActionType,
	ModerationCaseAction,
	ModerationCaseDetail,
	ModerationCaseEvent,
	ModerationQueueItem,
	ModerationUrgencyLevel,
	ReportStatus,
	ReportTargetType,
} from "@scrimflow/shared";
import {
	CreateModerationActionSchema,
	ModerationCasePatchSchema,
	ModerationQueueFilterSchema,
} from "@scrimflow/shared";
import { and, asc, count, desc, eq, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	chatMessageTable,
	moderationActionTable,
	moderationCaseEventTable,
	organizationTable,
	recruitmentListingTable,
	teamTable,
	updatePostTable,
	userReportSupplementTable,
	userReportTable,
	userTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const moderationRoutes = new Hono<AuthEnv>();

const PAGE_SIZE = 25;

function toModerationAction(row: typeof moderationActionTable.$inferSelect): ModerationAction {
	return {
		id: row.id,
		caseId: row.caseId ?? null,
		moderatorId: row.moderatorId,
		targetType: row.targetType,
		targetId: row.targetId,
		actionType: row.actionType as ModerationActionType,
		reason: row.reason,
		scope: (row.scope as Record<string, unknown> | null) ?? null,
		durationHours: row.durationHours ?? null,
		expiresAt: row.expiresAt?.toISOString() ?? null,
		isReversible: row.isReversible,
		reversedByModerationActionId: row.reversedByModerationActionId ?? null,
		reversedAt: row.reversedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
	};
}

async function getTargetSuspensionState(
	tx: typeof db,
	targetType: ReportTargetType,
	targetId: string
): Promise<boolean | null> {
	if (targetType === "user") {
		const u = await tx.query.userTable.findFirst({
			where: eq(userTable.id, targetId),
			columns: { isBanned: true },
		});
		return u?.isBanned ?? null;
	}
	if (targetType === "team") {
		const t = await tx.query.teamTable.findFirst({
			where: eq(teamTable.id, targetId),
			columns: { isModerationSuspended: true },
		});
		return t?.isModerationSuspended ?? null;
	}
	if (targetType === "organization") {
		const o = await tx.query.organizationTable.findFirst({
			where: eq(organizationTable.id, targetId),
			columns: { isModerationSuspended: true },
		});
		return o?.isModerationSuspended ?? null;
	}
	return null;
}

async function getTargetHiddenState(
	tx: typeof db,
	targetType: ReportTargetType,
	targetId: string
): Promise<boolean | null> {
	if (targetType === "listing") {
		const r = await tx.query.recruitmentListingTable.findFirst({
			where: eq(recruitmentListingTable.id, targetId),
			columns: { moderationHidden: true },
		});
		return r?.moderationHidden ?? null;
	}
	if (targetType === "update") {
		const u = await tx.query.updatePostTable.findFirst({
			where: eq(updatePostTable.id, targetId),
			columns: { moderationHidden: true },
		});
		return u?.moderationHidden ?? null;
	}
	if (targetType === "message") {
		const m = await tx.query.chatMessageTable.findFirst({
			where: eq(chatMessageTable.id, targetId),
			columns: { moderationHidden: true },
		});
		return m?.moderationHidden ?? null;
	}
	return null;
}

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

	const actionRows = await db.query.moderationActionTable.findMany({
		where: and(
			eq(moderationActionTable.targetType, report.targetType),
			eq(moderationActionTable.targetId, report.targetId),
			isNull(moderationActionTable.reversedAt)
		),
		orderBy: [desc(moderationActionTable.createdAt)],
	});

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
		activeActions: actionRows.map(toModerationAction),
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

const REPORT_TARGET_TYPE_VALUES = [
	"user",
	"team",
	"organization",
	"listing",
	"message",
	"scrim",
	"update",
	"ocr_evidence",
] as const;

const GetActionsQuerySchema = v.object({
	targetType: v.picklist(REPORT_TARGET_TYPE_VALUES),
	targetId: v.pipe(v.string(), v.uuid()),
});

moderationRoutes.get("/actions", async (c) => {
	const user = c.get("user");
	if (!user.isModerator)
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);

	const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
	const parsed = v.safeParse(GetActionsQuerySchema, rawQuery);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid query parameters.", issues: extractErrors(parsed.issues) },
			400
		);
	}

	const { targetType, targetId } = parsed.output;

	const actions = await db.query.moderationActionTable.findMany({
		where: and(
			eq(moderationActionTable.targetType, targetType),
			eq(moderationActionTable.targetId, targetId)
		),
		orderBy: [desc(moderationActionTable.createdAt)],
	});

	return c.json({ actions: actions.map(toModerationAction) });
});

moderationRoutes.post("/actions", async (c) => {
	const user = c.get("user");
	if (!user.isModerator)
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid JSON body." }, 400);

	const parsed = v.safeParse(CreateModerationActionSchema, body);
	if (!parsed.success) {
		return c.json({ error: "Invalid request body.", issues: extractErrors(parsed.issues) }, 400);
	}

	const input = parsed.output;

	// Validate action+targetType compatibility before entering the transaction
	const suspendableTypes = ["user", "team", "organization"] as const;
	const hidableTypes = ["listing", "update", "message"] as const;
	if (
		(input.actionType === "suspend" || input.actionType === "restore") &&
		!suspendableTypes.includes(input.targetType as (typeof suspendableTypes)[number])
	) {
		return c.json({ error: "Action type not supported for this target type." }, 422);
	}
	if (
		(input.actionType === "hide" ||
			input.actionType === "unhide" ||
			input.actionType === "remove") &&
		!hidableTypes.includes(input.targetType as (typeof hidableTypes)[number])
	) {
		return c.json({ error: "Action type not supported for this target type." }, 422);
	}
	if (
		(input.actionType === "require_verification" || input.actionType === "clear_verification") &&
		input.targetType !== "user"
	) {
		return c.json({ error: "Action type not supported for this target type." }, 422);
	}

	const isReversible = input.actionType !== "remove";
	const expiresAt = input.durationHours
		? new Date(Date.now() + input.durationHours * 3600 * 1000)
		: null;

	let actionRow: typeof moderationActionTable.$inferSelect | undefined;
	try {
		[actionRow] = await db.transaction(async (tx) => {
			// Idempotency guards (inside transaction to prevent races)
			if (input.actionType === "suspend") {
				const isSuspended = await getTargetSuspensionState(tx, input.targetType, input.targetId);
				if (isSuspended === true)
					throw Object.assign(new Error("Target is already suspended."), { status: 409 });
			} else if (input.actionType === "restore") {
				const isSuspended = await getTargetSuspensionState(tx, input.targetType, input.targetId);
				if (isSuspended === false)
					throw Object.assign(new Error("Target is not currently suspended."), { status: 409 });
			} else if (input.actionType === "hide" || input.actionType === "remove") {
				const isHidden = await getTargetHiddenState(tx, input.targetType, input.targetId);
				if (isHidden === true)
					throw Object.assign(new Error("Target is already hidden."), { status: 409 });
			} else if (input.actionType === "unhide") {
				const isHidden = await getTargetHiddenState(tx, input.targetType, input.targetId);
				if (isHidden === false)
					throw Object.assign(new Error("Target is not currently hidden."), { status: 409 });
				// Block unhide if a prior unreverted remove action exists (AC #3)
				const priorRemove = await tx.query.moderationActionTable.findFirst({
					where: and(
						eq(moderationActionTable.targetType, input.targetType),
						eq(moderationActionTable.targetId, input.targetId),
						eq(moderationActionTable.actionType, "remove"),
						isNull(moderationActionTable.reversedAt)
					),
					columns: { id: true },
				});
				if (priorRemove)
					throw Object.assign(
						new Error(
							"Target was removed and cannot be unhidden directly. Reverse the remove action instead."
						),
						{ status: 409 }
					);
			} else if (input.actionType === "require_verification") {
				const u = await tx.query.userTable.findFirst({
					where: eq(userTable.id, input.targetId),
					columns: { requiresReverification: true },
				});
				if (u?.requiresReverification === true)
					throw Object.assign(new Error("User is already flagged for reverification."), {
						status: 409,
					});
			} else if (input.actionType === "clear_verification") {
				const u = await tx.query.userTable.findFirst({
					where: eq(userTable.id, input.targetId),
					columns: { requiresReverification: true },
				});
				if (u?.requiresReverification === false)
					throw Object.assign(new Error("User is not currently flagged for reverification."), {
						status: 409,
					});
			}

			// Apply side effects
			if (input.actionType === "suspend" && input.targetType === "user") {
				await tx.update(userTable).set({ isBanned: true }).where(eq(userTable.id, input.targetId));
			} else if (input.actionType === "restore" && input.targetType === "user") {
				await tx.update(userTable).set({ isBanned: false }).where(eq(userTable.id, input.targetId));
			} else if (input.actionType === "require_verification" && input.targetType === "user") {
				await tx
					.update(userTable)
					.set({ requiresReverification: true })
					.where(eq(userTable.id, input.targetId));
			} else if (input.actionType === "clear_verification" && input.targetType === "user") {
				await tx
					.update(userTable)
					.set({ requiresReverification: false })
					.where(eq(userTable.id, input.targetId));
			} else if (input.actionType === "suspend" && input.targetType === "team") {
				await tx
					.update(teamTable)
					.set({ isModerationSuspended: true })
					.where(eq(teamTable.id, input.targetId));
			} else if (input.actionType === "restore" && input.targetType === "team") {
				await tx
					.update(teamTable)
					.set({ isModerationSuspended: false })
					.where(eq(teamTable.id, input.targetId));
			} else if (input.actionType === "suspend" && input.targetType === "organization") {
				await tx
					.update(organizationTable)
					.set({ isModerationSuspended: true })
					.where(eq(organizationTable.id, input.targetId));
			} else if (input.actionType === "restore" && input.targetType === "organization") {
				await tx
					.update(organizationTable)
					.set({ isModerationSuspended: false })
					.where(eq(organizationTable.id, input.targetId));
			} else if (
				(input.actionType === "hide" || input.actionType === "remove") &&
				input.targetType === "listing"
			) {
				await tx
					.update(recruitmentListingTable)
					.set({ moderationHidden: true })
					.where(eq(recruitmentListingTable.id, input.targetId));
			} else if (input.actionType === "unhide" && input.targetType === "listing") {
				await tx
					.update(recruitmentListingTable)
					.set({ moderationHidden: false })
					.where(eq(recruitmentListingTable.id, input.targetId));
			} else if (
				(input.actionType === "hide" || input.actionType === "remove") &&
				input.targetType === "update"
			) {
				await tx
					.update(updatePostTable)
					.set({ moderationHidden: true })
					.where(eq(updatePostTable.id, input.targetId));
			} else if (input.actionType === "unhide" && input.targetType === "update") {
				await tx
					.update(updatePostTable)
					.set({ moderationHidden: false })
					.where(eq(updatePostTable.id, input.targetId));
			} else if (
				(input.actionType === "hide" || input.actionType === "remove") &&
				input.targetType === "message"
			) {
				await tx
					.update(chatMessageTable)
					.set({ moderationHidden: true })
					.where(eq(chatMessageTable.id, input.targetId));
			} else if (input.actionType === "unhide" && input.targetType === "message") {
				await tx
					.update(chatMessageTable)
					.set({ moderationHidden: false })
					.where(eq(chatMessageTable.id, input.targetId));
			}

			return tx
				.insert(moderationActionTable)
				.values({
					caseId: input.caseId ?? null,
					moderatorId: user.id,
					targetType: input.targetType,
					targetId: input.targetId,
					actionType: input.actionType,
					reason: input.reason,
					scope: input.scope ?? null,
					durationHours: input.durationHours ?? null,
					expiresAt,
					isReversible,
				})
				.returning();
		});
	} catch (err) {
		if (err instanceof Error && (err as Error & { status?: number }).status === 409) {
			return c.json({ error: err.message }, 409);
		}
		throw err;
	}

	// biome-ignore lint/style/noNonNullAssertion: actionRow is set by the transaction above
	return c.json({ action: toModerationAction(actionRow!) }, 201);
});

moderationRoutes.post("/actions/:actionId/reverse", async (c) => {
	const user = c.get("user");
	if (!user.isModerator)
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);

	const actionId = c.req.param("actionId");

	const original = await db.query.moderationActionTable.findFirst({
		where: eq(moderationActionTable.id, actionId),
	});
	if (!original) return c.json({ error: "Action not found." }, 404);

	if (!original.isReversible) {
		return c.json({ error: "This action is irreversible and cannot be reversed." }, 409);
	}

	let compensatingType: ModerationActionType;
	if (original.actionType === "suspend") {
		compensatingType = "restore";
	} else if (original.actionType === "hide") {
		compensatingType = "unhide";
	} else if (original.actionType === "require_verification") {
		compensatingType = "clear_verification";
	} else {
		return c.json({ error: "This action type does not support reversal." }, 409);
	}

	const now = new Date();

	let newAction: typeof moderationActionTable.$inferSelect | undefined;
	try {
		[newAction] = await db.transaction(async (tx) => {
			// Re-check reversal guard inside transaction to prevent double-reversal races
			const fresh = await tx.query.moderationActionTable.findFirst({
				where: eq(moderationActionTable.id, original.id),
				columns: { reversedAt: true },
			});
			if (fresh?.reversedAt) {
				throw Object.assign(new Error("This action has already been reversed."), { status: 409 });
			}

			// Apply compensating side effect
			if (compensatingType === "restore" && original.targetType === "user") {
				await tx
					.update(userTable)
					.set({ isBanned: false })
					.where(eq(userTable.id, original.targetId));
			} else if (compensatingType === "restore" && original.targetType === "team") {
				await tx
					.update(teamTable)
					.set({ isModerationSuspended: false })
					.where(eq(teamTable.id, original.targetId));
			} else if (compensatingType === "restore" && original.targetType === "organization") {
				await tx
					.update(organizationTable)
					.set({ isModerationSuspended: false })
					.where(eq(organizationTable.id, original.targetId));
			} else if (compensatingType === "clear_verification" && original.targetType === "user") {
				await tx
					.update(userTable)
					.set({ requiresReverification: false })
					.where(eq(userTable.id, original.targetId));
			} else if (compensatingType === "unhide" && original.targetType === "listing") {
				await tx
					.update(recruitmentListingTable)
					.set({ moderationHidden: false })
					.where(eq(recruitmentListingTable.id, original.targetId));
			} else if (compensatingType === "unhide" && original.targetType === "update") {
				await tx
					.update(updatePostTable)
					.set({ moderationHidden: false })
					.where(eq(updatePostTable.id, original.targetId));
			} else if (compensatingType === "unhide" && original.targetType === "message") {
				await tx
					.update(chatMessageTable)
					.set({ moderationHidden: false })
					.where(eq(chatMessageTable.id, original.targetId));
			}

			const [inserted] = await tx
				.insert(moderationActionTable)
				.values({
					caseId: original.caseId,
					moderatorId: user.id,
					targetType: original.targetType,
					targetId: original.targetId,
					actionType: compensatingType,
					reason: `Reversal of action ${original.id}`,
					isReversible: true,
				})
				.returning();

			await tx
				.update(moderationActionTable)
				.set({ reversedByModerationActionId: inserted.id, reversedAt: now })
				.where(eq(moderationActionTable.id, original.id));

			return [inserted];
		});
	} catch (err) {
		if (err instanceof Error && (err as Error & { status?: number }).status === 409) {
			return c.json({ error: err.message }, 409);
		}
		throw err;
	}

	// biome-ignore lint/style/noNonNullAssertion: newAction is set by the transaction above
	return c.json({ action: toModerationAction(newAction!) });
});

export { moderationRoutes };

import type {
	DomainAuditEvent,
	GovernanceAvailableAction,
	GovernanceEntityState,
	GovernancePendingItem,
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
	DomainAuditQuerySchema,
	ModerationCasePatchSchema,
	ModerationQueueFilterSchema,
	ModeratorOwnershipResolutionSchema,
} from "@scrimflow/shared";
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import * as v from "valibot";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import { db } from "@/db";
import {
	accountDeletionRequestTable,
	chatMessageTable,
	domainAuditEventTable,
	moderationActionTable,
	moderationCaseEventTable,
	organizationTable,
	ownershipWorkflowEventTable,
	ownershipWorkflowTable,
	recruitmentListingTable,
	teamTable,
	updatePostTable,
	userReportSupplementTable,
	userReportTable,
	userTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { decodeCursor, encodeCursor } from "@/utils/cursor";
import { getCurrentOwnershipWorkflow, mapOwnershipWorkflow } from "@/utils/ownership";
import { ensureOrganizationMembership, ensureTeamMembership } from "@/utils/recruit";

const moderationRoutes = new Hono<AuthEnv>();

const PAGE_SIZE = 25;
const GOVERNANCE_PAGE_SIZE = 25;

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

function toDomainAuditEvent(row: typeof domainAuditEventTable.$inferSelect): DomainAuditEvent {
	return {
		id: row.id,
		actorId: row.actorId ?? null,
		actorType: row.actorType,
		domain: row.domain,
		actionType: row.actionType,
		targetType: row.targetType ?? null,
		targetId: row.targetId ?? null,
		outcome: row.outcome ?? null,
		reason: row.reason ?? null,
		metadata: (row.metadata as Record<string, unknown> | null) ?? null,
		linkedCaseId: row.linkedCaseId ?? null,
		linkedScrimId: row.linkedScrimId ?? null,
		createdAt: row.createdAt.toISOString(),
	};
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getTargetSuspensionState(
	tx: DbTransaction,
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
	tx: DbTransaction,
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

	if (filters.cursor) {
		try {
			const { id: cursorId, createdAt: cursorCreatedAt } = decodeCursor(filters.cursor);
			const cursorDate = new Date(cursorCreatedAt);
			conditions.push(
				or(
					gt(userReportTable.createdAt, cursorDate),
					and(eq(userReportTable.createdAt, cursorDate), gt(userReportTable.id, cursorId))
				)
			);
		} catch {
			return c.json({ error: "Invalid cursor." }, 400);
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
		.orderBy(asc(userReportTable.createdAt), asc(userReportTable.id))
		.limit(PAGE_SIZE + 1);

	const hasMore = rows.length > PAGE_SIZE;
	const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
	const lastRow = pageRows[pageRows.length - 1];
	const nextCursor =
		hasMore && lastRow
			? encodeCursor({ id: lastRow.report.id, createdAt: lastRow.report.createdAt.toISOString() })
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
		data: {
			items,
			nextCursor,
			filters: {
				...(filters.status && { status: filters.status }),
				...(filters.category && { category: filters.category }),
				...(filters.targetType && { targetType: filters.targetType }),
				...(filters.assignedTo && { assignedTo: filters.assignedTo }),
			},
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
			eq(moderationActionTable.targetId, report.targetId)
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

	return c.json({ data: detail });
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
	const completedAction = actionRow!;
	writeDomainAuditEvent({
		actorId: user.id,
		actorType: "user",
		domain: "moderation",
		actionType: "moderation_action_taken",
		targetType: input.targetType,
		targetId: input.targetId,
		outcome: "success",
		reason: input.reason,
		metadata: { actionType: input.actionType, actionId: completedAction.id },
		linkedCaseId: input.caseId ?? null,
	});
	return c.json({ action: toModerationAction(completedAction) }, 201);
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
	const compensatingAction = newAction!;
	writeDomainAuditEvent({
		actorId: user.id,
		actorType: "user",
		domain: "moderation",
		actionType: "moderation_action_reversed",
		targetType: original.targetType,
		targetId: original.targetId,
		outcome: "success",
		reason: `Reversal of action ${actionId}`,
		metadata: { originalActionId: actionId, compensatingActionId: compensatingAction.id },
		linkedCaseId: original.caseId ?? null,
	});
	return c.json({ action: toModerationAction(compensatingAction) });
});

moderationRoutes.get("/audit", async (c) => {
	const user = c.get("user");
	if (!user.isModerator)
		return c.json({ error: "Moderator access required.", reason: "role" }, 403);

	const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
	if (rawQuery.limit) {
		const n = Number(rawQuery.limit);
		if (!Number.isFinite(n)) return c.json({ error: "Invalid query parameters." }, 400);
		rawQuery.limit = n as unknown as string;
	}
	const parsed = v.safeParse(DomainAuditQuerySchema, rawQuery);
	if (!parsed.success)
		return c.json({ error: "Invalid query parameters.", issues: parsed.issues }, 400);

	const q = parsed.output;
	const limit = q.limit ?? 50;
	const conditions = [];

	if (q.actorId) conditions.push(eq(domainAuditEventTable.actorId, q.actorId));
	if (q.domain) conditions.push(eq(domainAuditEventTable.domain, q.domain));
	if (q.actionType) conditions.push(eq(domainAuditEventTable.actionType, q.actionType));
	if (q.targetType) conditions.push(eq(domainAuditEventTable.targetType, q.targetType));
	if (q.targetId) conditions.push(eq(domainAuditEventTable.targetId, q.targetId));
	if (q.outcome) conditions.push(eq(domainAuditEventTable.outcome, q.outcome));
	if (q.from) conditions.push(gte(domainAuditEventTable.createdAt, new Date(q.from)));
	if (q.to) conditions.push(lte(domainAuditEventTable.createdAt, new Date(q.to)));

	// Compound keyset cursor: "<ISO timestamp>_<uuid>" — stable across same-millisecond events
	if (q.cursor) {
		const sepIdx = q.cursor.indexOf("_");
		if (sepIdx === -1) return c.json({ error: "Invalid cursor." }, 400);
		const cursorTs = new Date(q.cursor.slice(0, sepIdx));
		const cursorId = q.cursor.slice(sepIdx + 1);
		if (!Number.isFinite(cursorTs.getTime()) || !cursorId) {
			return c.json({ error: "Invalid cursor." }, 400);
		}
		const cursorCondition = or(
			lt(domainAuditEventTable.createdAt, cursorTs),
			and(eq(domainAuditEventTable.createdAt, cursorTs), lt(domainAuditEventTable.id, cursorId))
		);
		if (cursorCondition) conditions.push(cursorCondition);
	}

	const rows = await db.query.domainAuditEventTable.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: [desc(domainAuditEventTable.createdAt), desc(domainAuditEventTable.id)],
		limit: limit + 1,
	});

	const hasMore = rows.length > limit;
	const events = rows.slice(0, limit).map(toDomainAuditEvent);
	const nextCursor = hasMore ? `${rows[limit].createdAt.toISOString()}_${rows[limit].id}` : null;

	return c.json({ data: { events, hasMore, nextCursor } });
});

moderationRoutes.get("/governance/entities/:entityType/:entityId", async (c) => {
	const user = c.var.user;
	if (!user.isModerator) return c.json({ error: "Forbidden." }, 403);

	const { entityType, entityId } = c.req.param();
	if (!["user", "team", "organization"].includes(entityType)) {
		return c.json({ error: "Invalid entityType." }, 400);
	}
	const entityIdResult = v.safeParse(v.pipe(v.string(), v.uuid()), entityId);
	if (!entityIdResult.success) return c.json({ error: "Invalid entityId." }, 400);

	const validEntityType = entityType as "user" | "team" | "organization";

	let displayName = "";
	let isSuspended = false;
	let isArchived = false;
	let isDeletionPending = false;
	let isAnonymized = false;
	let requiresReverification = false;

	if (validEntityType === "user") {
		const row = await db.query.userTable.findFirst({
			where: eq(userTable.id, entityId),
			columns: {
				id: true,
				displayName: true,
				isBanned: true,
				isAnonymized: true,
				requiresReverification: true,
			},
		});
		if (!row) return c.json({ error: "Not found." }, 404);
		displayName = row.displayName ?? "";
		isSuspended = row.isBanned ?? false;
		isAnonymized = row.isAnonymized ?? false;
		requiresReverification = row.requiresReverification ?? false;
		const deletionReq = await db.query.accountDeletionRequestTable.findFirst({
			where: and(
				eq(accountDeletionRequestTable.userId, entityId),
				isNull(accountDeletionRequestTable.cancelledAt)
			),
			columns: { id: true, confirmedAt: true },
		});
		isDeletionPending = !!deletionReq?.confirmedAt;
	} else if (validEntityType === "team") {
		const row = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, entityId),
			columns: { id: true, name: true, isModerationSuspended: true, isArchived: true },
		});
		if (!row) return c.json({ error: "Not found." }, 404);
		displayName = row.name;
		isSuspended = row.isModerationSuspended ?? false;
		isArchived = row.isArchived ?? false;
	} else {
		const row = await db.query.organizationTable.findFirst({
			where: eq(organizationTable.id, entityId),
			columns: { id: true, name: true, isModerationSuspended: true, lifecycleStatus: true },
		});
		if (!row) return c.json({ error: "Not found." }, 404);
		displayName = row.name;
		isSuspended = row.isModerationSuspended ?? false;
		// Organizations have no denormalised is_archived flag; lifecycleStatus is the source of
		// truth (invariant: is_archived = lifecycle_status != "active").
		isArchived = row.lifecycleStatus !== "active";
	}

	const [activeActions, recentAuditRows, ownershipWorkflowRaw] = await Promise.all([
		db.query.moderationActionTable.findMany({
			where: and(
				eq(moderationActionTable.targetType, validEntityType),
				eq(moderationActionTable.targetId, entityId),
				isNull(moderationActionTable.reversedAt)
			),
			orderBy: [desc(moderationActionTable.createdAt)],
		}),
		db.query.domainAuditEventTable.findMany({
			where: and(
				eq(domainAuditEventTable.targetType, validEntityType),
				eq(domainAuditEventTable.targetId, entityId)
			),
			orderBy: [desc(domainAuditEventTable.createdAt)],
			limit: 10,
		}),
		validEntityType === "team" || validEntityType === "organization"
			? getCurrentOwnershipWorkflow(validEntityType, entityId)
			: Promise.resolve(null),
	]);
	const ownershipWorkflow = ownershipWorkflowRaw
		? mapOwnershipWorkflow(ownershipWorkflowRaw, "authorized")
		: null;

	const availableActions: GovernanceAvailableAction[] = [];
	if (isSuspended) {
		availableActions.push("restore");
	} else {
		availableActions.push("suspend");
	}
	if (
		ownershipWorkflow &&
		(ownershipWorkflow.status === "review_required" || ownershipWorkflow.status === "blocked")
	) {
		availableActions.push("resolve_ownership");
	}
	if (validEntityType === "user") {
		if (requiresReverification) {
			availableActions.push("clear_verification");
		} else {
			availableActions.push("require_verification");
		}
	}

	const state: GovernanceEntityState = {
		entityType: validEntityType,
		entityId,
		displayName,
		isSuspended,
		isArchived,
		isDeletionPending,
		isAnonymized,
		ownershipWorkflow,
		activeActions: activeActions.map(toModerationAction),
		recentAuditEvents: recentAuditRows.map(toDomainAuditEvent),
		availableActions,
	};

	return c.json({ data: state });
});

moderationRoutes.post("/governance/ownership/:workflowId/resolve", async (c) => {
	const user = c.var.user;
	if (!user.isModerator) return c.json({ error: "Forbidden." }, 403);

	const { workflowId } = c.req.param();
	const workflowIdValidation = v.safeParse(v.pipe(v.string(), v.uuid()), workflowId);
	if (!workflowIdValidation.success) return c.json({ error: "Invalid workflowId." }, 400);

	const body = await c.req.json();
	const parsed = v.safeParse(ModeratorOwnershipResolutionSchema, body);
	if (!parsed.success)
		return c.json({ error: "Invalid input.", issues: extractErrors(parsed.issues) }, 400);
	const input = parsed.output;

	const workflow = await db.query.ownershipWorkflowTable.findFirst({
		where: eq(ownershipWorkflowTable.id, workflowId),
		with: {
			requester: { columns: { id: true, displayName: true } },
			currentOwner: { columns: { id: true, displayName: true } },
			recipient: { columns: { id: true, displayName: true } },
			recoveryTarget: { columns: { id: true, displayName: true } },
		},
	});
	if (!workflow) return c.json({ error: "Workflow not found." }, 404);
	if (!["review_required", "blocked"].includes(workflow.status)) {
		return c.json({ error: "Workflow is not in a resolvable governance state." }, 409);
	}
	if (input.action === "approve" && !workflow.recoveryTargetUserId) {
		return c.json({ error: "Recovery workflow has no target user." }, 409);
	}
	if (input.action === "approve" && !["team", "organization"].includes(workflow.entityType)) {
		return c.json({ error: "Unsupported entity type for ownership resolution." }, 409);
	}

	const fromStatus = workflow.status;
	const newStatus = input.action === "approve" ? "approved" : "rejected";
	const newResult = input.action === "approve" ? "recovered" : "rejected";

	const recoveryTargetUserId = workflow.recoveryTargetUserId;

	await db.transaction(async (tx) => {
		if (input.action === "approve" && recoveryTargetUserId) {
			if (workflow.entityType === "team") {
				await ensureTeamMembership(tx, {
					teamId: workflow.entityId,
					userId: recoveryTargetUserId,
					permissionRole: "admin",
					status: "active",
				});
			} else if (workflow.entityType === "organization") {
				await ensureOrganizationMembership(tx, {
					organizationId: workflow.entityId,
					userId: recoveryTargetUserId,
					role: "owner",
				});
			}
		}

		const updateRows = await tx
			.update(ownershipWorkflowTable)
			.set({
				status: newStatus,
				reviewState: input.action === "approve" ? "approved" : "rejected",
				result: newResult,
				resolvedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(ownershipWorkflowTable.id, workflowId),
					inArray(ownershipWorkflowTable.status, ["review_required", "blocked"])
				)
			)
			.returning({ id: ownershipWorkflowTable.id });

		if (updateRows.length === 0) {
			throw new Error("Workflow status changed concurrently. Please retry.");
		}

		await tx.insert(ownershipWorkflowEventTable).values({
			workflowId,
			actorUserId: user.id,
			action: "governance_resolved",
			fromStatus,
			toStatus: newStatus,
			reason: input.reason,
			metadata: { resultReason: `governance_resolved:moderator:${input.action}` },
		});
	});

	writeDomainAuditEvent({
		domain: "governance",
		actionType: "governance_recovery_applied",
		targetType: workflow.entityType,
		targetId: workflow.entityId,
		actorId: user.id,
		actorType: "user",
		outcome: "success",
		reason: input.reason,
		metadata: { workflowId, action: input.action, escalationTier: "moderator" },
	});

	const updatedWorkflow = await db.query.ownershipWorkflowTable.findFirst({
		where: eq(ownershipWorkflowTable.id, workflowId),
		with: {
			requester: { columns: { id: true, displayName: true } },
			currentOwner: { columns: { id: true, displayName: true } },
			recipient: { columns: { id: true, displayName: true } },
			recoveryTarget: { columns: { id: true, displayName: true } },
		},
	});
	if (!updatedWorkflow) return c.json({ error: "Workflow not found after update." }, 500);

	return c.json(mapOwnershipWorkflow(updatedWorkflow, "authorized"));
});

moderationRoutes.get("/governance/pending", async (c) => {
	const user = c.var.user;
	if (!user.isModerator) return c.json({ error: "Forbidden." }, 403);

	const cursorParam = c.req.query("cursor");
	let cursor: { id: string; createdAt: string } | null = null;
	if (cursorParam) {
		try {
			cursor = decodeCursor(cursorParam);
		} catch {
			return c.json({ error: "Invalid cursor." }, 400);
		}
	}

	const [pendingWorkflows, suspendedUsers, suspendedTeamsRows, suspendedOrgsRows] =
		await Promise.all([
			db.query.ownershipWorkflowTable.findMany({
				where: inArray(ownershipWorkflowTable.status, ["review_required", "blocked"]),
			}),
			db.query.userTable.findMany({
				where: and(eq(userTable.isBanned, true), eq(userTable.isAnonymized, false)),
				columns: { id: true, displayName: true, updatedAt: true, createdAt: true },
			}),
			db.query.teamTable.findMany({
				where: eq(teamTable.isModerationSuspended, true),
				columns: { id: true, name: true, updatedAt: true, createdAt: true },
			}),
			db.query.organizationTable.findMany({
				where: eq(organizationTable.isModerationSuspended, true),
				columns: { id: true, name: true, updatedAt: true, createdAt: true },
			}),
		]);

	// Build entity name map for pending ownership workflows (show entity name, not requester name)
	const wfTeamIds = pendingWorkflows
		.filter((wf) => wf.entityType === "team")
		.map((wf) => wf.entityId);
	const wfOrgIds = pendingWorkflows
		.filter((wf) => wf.entityType === "organization")
		.map((wf) => wf.entityId);
	const [wfTeams, wfOrgs] = await Promise.all([
		wfTeamIds.length > 0
			? db.query.teamTable.findMany({
					where: inArray(teamTable.id, wfTeamIds),
					columns: { id: true, name: true },
				})
			: [],
		wfOrgIds.length > 0
			? db.query.organizationTable.findMany({
					where: inArray(organizationTable.id, wfOrgIds),
					columns: { id: true, name: true },
				})
			: [],
	]);
	const entityNameMap = new Map<string, string>([
		...wfTeams.map((t) => [t.id, t.name] as [string, string]),
		...wfOrgs.map((o) => [o.id, o.name] as [string, string]),
	]);

	function getItemCursorId(item: GovernancePendingItem): string {
		return item.workflowId ?? item.entityId;
	}

	const allItems: GovernancePendingItem[] = [
		...pendingWorkflows.map((wf) => ({
			entityType: wf.entityType as "team" | "organization",
			entityId: wf.entityId,
			displayName: entityNameMap.get(wf.entityId) ?? wf.entityId,
			reason: "blocked_ownership" as const,
			workflowId: wf.id,
			workflowStatus: wf.status as GovernancePendingItem["workflowStatus"],
			since: wf.updatedAt.toISOString(),
		})),
		...suspendedUsers.map((u) => ({
			entityType: "user" as const,
			entityId: u.id,
			displayName: u.displayName ?? u.id,
			reason: "suspended" as const,
			since: (u.updatedAt ?? u.createdAt).toISOString(),
		})),
		...suspendedTeamsRows.map((t) => ({
			entityType: "team" as const,
			entityId: t.id,
			displayName: t.name,
			reason: "suspended" as const,
			since: (t.updatedAt ?? t.createdAt).toISOString(),
		})),
		...suspendedOrgsRows.map((o) => ({
			entityType: "organization" as const,
			entityId: o.id,
			displayName: o.name,
			reason: "suspended" as const,
			since: (o.updatedAt ?? o.createdAt).toISOString(),
		})),
	];

	// Sort by (since ASC, cursorId ASC)
	allItems.sort((a, b) => {
		if (a.since < b.since) return -1;
		if (a.since > b.since) return 1;
		const aId = getItemCursorId(a);
		const bId = getItemCursorId(b);
		return aId < bId ? -1 : aId > bId ? 1 : 0;
	});

	// Apply cursor filter
	let pageItems = allItems;
	if (cursor) {
		const { id: cursorId, createdAt: cursorCreatedAt } = cursor;
		pageItems = allItems.filter((item) => {
			if (item.since > cursorCreatedAt) return true;
			if (item.since === cursorCreatedAt && getItemCursorId(item) > cursorId) return true;
			return false;
		});
	}

	// Paginate
	const hasMore = pageItems.length > GOVERNANCE_PAGE_SIZE;
	const sliced = hasMore ? pageItems.slice(0, GOVERNANCE_PAGE_SIZE) : pageItems;
	const lastItem = sliced[sliced.length - 1];
	const nextCursor =
		hasMore && lastItem
			? encodeCursor({ id: getItemCursorId(lastItem), createdAt: lastItem.since })
			: null;

	return c.json({ data: { items: sliced, nextCursor } });
});

export { moderationRoutes };

import {
	AddReportSupplementSchema,
	type ReportTargetType,
	rateLimits,
	SubmitReportSchema,
} from "@scrimflow/shared";
import { and, eq, gt, inArray, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	chatMessageTable,
	ocrJobTable,
	organizationTable,
	playerProfileTable,
	recruitmentListingTable,
	scrimTable,
	teamTable,
	updatePostTable,
	userReportSupplementTable,
	userReportTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { checkRateLimit, formatRetryAfter } from "@/rate-limit";
import { extractErrors } from "@/routes/auth/utils";
import { decodeCursor, encodeCursor } from "@/utils/cursor";

const reportRoutes = new Hono<AuthEnv>();

async function snapshotTarget(
	targetType: ReportTargetType,
	targetId: string
): Promise<Record<string, unknown> | null> {
	switch (targetType) {
		case "user": {
			const row = await db.query.playerProfileTable.findFirst({
				where: eq(playerProfileTable.userId, targetId),
				columns: { displayName: true, username: true, avatarUrl: true },
			});
			return row ?? null;
		}
		case "team": {
			const row = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, targetId),
				columns: { name: true, tag: true, slug: true },
			});
			return row ?? null;
		}
		case "organization": {
			const row = await db.query.organizationTable.findFirst({
				where: eq(organizationTable.id, targetId),
				columns: { name: true, slug: true },
			});
			return row ?? null;
		}
		case "listing": {
			const row = await db.query.recruitmentListingTable.findFirst({
				where: eq(recruitmentListingTable.id, targetId),
				columns: { title: true, category: true },
			});
			return row ?? null;
		}
		case "message": {
			const row = await db.query.chatMessageTable.findFirst({
				where: eq(chatMessageTable.id, targetId),
				columns: { content: true, channelId: true, senderId: true },
			});
			return row ? { ...row, content: row.content?.slice(0, 200) } : null;
		}
		case "scrim": {
			const row = await db.query.scrimTable.findFirst({
				where: eq(scrimTable.id, targetId),
				columns: { status: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
			});
			return row ?? null;
		}
		case "update": {
			const row = await db.query.updatePostTable.findFirst({
				where: eq(updatePostTable.id, targetId),
				columns: { title: true, teamId: true, organizationId: true },
			});
			return row ?? null;
		}
		case "ocr_evidence": {
			const row = await db.query.ocrJobTable.findFirst({
				where: eq(ocrJobTable.id, targetId),
				columns: { scrimId: true, screenshotType: true, status: true },
			});
			return row ?? null;
		}
		default:
			return null;
	}
}

// POST /api/reports — submit a new report
reportRoutes.post("/", async (c) => {
	const user = c.get("user");

	const { allowed, retryAfterMs } = await checkRateLimit(
		`report:submit:user:${user.id}`,
		rateLimits.reportSubmit.limit,
		rateLimits.reportSubmit.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: "Too many reports submitted. Please try again later.",
				retryAfter: formatRetryAfter(retryAfterMs),
			},
			429
		);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(SubmitReportSchema, body);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid report data.", fieldErrors: extractErrors(parsed.issues) },
			400
		);
	}
	const { targetType, targetId, category, reason } = parsed.output;

	const existing = await db.query.userReportTable.findFirst({
		where: and(
			eq(userReportTable.reporterId, user.id),
			eq(userReportTable.targetType, targetType),
			eq(userReportTable.targetId, targetId),
			inArray(userReportTable.status, ["pending", "under_review"])
		),
		columns: { id: true },
	});
	if (existing) {
		return c.json(
			{
				error:
					"You already have a pending report for this target. Add a supplement to your existing report instead.",
				existingReportId: existing.id,
			},
			409
		);
	}

	const targetSnapshot = await snapshotTarget(targetType, targetId);
	if (targetSnapshot === null) {
		return c.json({ error: "Report target not found." }, 422);
	}

	const [inserted] = await db
		.insert(userReportTable)
		.values({
			reporterId: user.id,
			targetType,
			targetId,
			category,
			reason,
			targetSnapshot,
		})
		.returning({ id: userReportTable.id });

	return c.json({ reportId: inserted.id, status: "pending" }, 201);
});

const REPORTS_PAGE_SIZE = 25;

// GET /api/reports/mine — reporter's own reports
reportRoutes.get("/mine", async (c) => {
	const user = c.get("user");
	const cursorParam = c.req.query("cursor");

	let cursorWhere: SQL | undefined;
	if (cursorParam) {
		try {
			const { id: cursorId, createdAt: cursorCreatedAt } = decodeCursor(cursorParam);
			const cursorDate = new Date(cursorCreatedAt);
			cursorWhere = or(
				gt(userReportTable.createdAt, cursorDate),
				and(eq(userReportTable.createdAt, cursorDate), gt(userReportTable.id, cursorId))
			);
		} catch {
			return c.json({ error: "Invalid cursor." }, 400);
		}
	}

	const rows = await db.query.userReportTable.findMany({
		where: and(eq(userReportTable.reporterId, user.id), cursorWhere),
		columns: {
			id: true,
			targetType: true,
			targetId: true,
			category: true,
			status: true,
			createdAt: true,
		},
		orderBy: (table, { asc }) => [asc(table.createdAt), asc(table.id)],
		limit: REPORTS_PAGE_SIZE + 1,
	});

	const hasMore = rows.length > REPORTS_PAGE_SIZE;
	const items = hasMore ? rows.slice(0, REPORTS_PAGE_SIZE) : rows;
	const lastItem = items.at(-1);
	const nextCursor =
		hasMore && lastItem
			? encodeCursor({ id: lastItem.id, createdAt: lastItem.createdAt.toISOString() })
			: null;

	return c.json({
		items: items.map((r) => ({
			id: r.id,
			targetType: r.targetType,
			targetId: r.targetId,
			category: r.category,
			status: r.status,
			createdAt: r.createdAt.toISOString(),
		})),
		nextCursor,
	});
});

// POST /api/reports/:id/supplement — add supplemental context
reportRoutes.post("/:id/supplement", async (c) => {
	const user = c.get("user");
	const id = c.req.param("id");

	const report = await db.query.userReportTable.findFirst({
		where: eq(userReportTable.id, id),
		columns: { id: true, reporterId: true, status: true },
	});

	if (!report) {
		return c.json({ error: "Report not found." }, 404);
	}
	if (report.reporterId !== user.id) {
		return c.json({ error: "Forbidden." }, 403);
	}
	if (report.status === "resolved" || report.status === "dismissed") {
		return c.json({ error: "Cannot add supplement to a closed report." }, 400);
	}

	const { allowed, retryAfterMs } = await checkRateLimit(
		`report:supplement:user:${user.id}`,
		rateLimits.reportSupplement.limit,
		rateLimits.reportSupplement.windowMs
	);
	if (!allowed) {
		return c.json(
			{
				error: "Too many supplements submitted. Please try again later.",
				retryAfter: formatRetryAfter(retryAfterMs),
			},
			429
		);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = v.safeParse(AddReportSupplementSchema, body);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid supplement data.", fieldErrors: extractErrors(parsed.issues) },
			400
		);
	}

	const [inserted] = await db
		.insert(userReportSupplementTable)
		.values({ reportId: id, authorId: user.id, content: parsed.output.content })
		.returning({ id: userReportSupplementTable.id });

	return c.json({ supplementId: inserted.id }, 201);
});

export { reportRoutes };

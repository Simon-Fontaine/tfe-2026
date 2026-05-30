import { CreateScrimSchema } from "@scrimflow/shared";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import type { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import {
	ocrJobTable,
	scrimConfirmationTable,
	scrimTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { ensureScrimConversationLifecycle } from "@/utils/chat";
import logger from "@/utils/logger";
import { verifyTeamManager } from "@/utils/team";
import { canAccessScrim, canViewTeam, notifyTeamAdmins } from "./access";
import { TEAM_VIEWABLE_STATUSES } from "./constants";
import { mapScrimDetail, mapScrimSummary } from "./detail";
import { findScrimWithRelations, toIsoDate } from "./shared";

export function registerScrimListCreateRoutes(scrimRoutes: Hono<AuthEnv>) {
	scrimRoutes.get("/", async (c) => {
		const user = c.get("user");
		const requestedTeamId = c.req.query("teamId");

		let teamIds: string[] = [];

		if (requestedTeamId) {
			const allowed = await canViewTeam(requestedTeamId, user.id);
			if (!allowed) {
				return c.json({ error: "You do not have access to this team's scrims." }, 403);
			}
			teamIds = [requestedTeamId];
		} else {
			const memberships = await db.query.teamRosterTable.findMany({
				where: and(
					eq(teamRosterTable.userId, user.id),
					inArray(teamRosterTable.status, TEAM_VIEWABLE_STATUSES)
				),
				columns: { teamId: true },
			});
			teamIds = [...new Set(memberships.map((membership) => membership.teamId))];
		}

		if (teamIds.length === 0) {
			return c.json({ data: [], nextCursor: null });
		}

		const cursor = c.req.query("cursor") ?? null;
		const limitParam = Number(c.req.query("limit") ?? "20");
		const limit = Math.min(Math.max(1, limitParam), 50);

		const ACTIVE_STATUSES = [
			"pending",
			"accepted",
			"scheduled",
			"in_progress",
			"awaiting_confirmation",
			"disputed",
		] as const;
		const PAST_STATUSES = ["completed", "cancelled"] as const;

		const teamFilter = or(
			inArray(scrimTable.homeTeamId, teamIds),
			inArray(scrimTable.awayTeamId, teamIds)
		);

		const scrimWith = {
			homeTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
					isArchived: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			awayTeam: {
				columns: {
					id: true,
					name: true,
					tag: true,
					organizationId: true,
					avatarUrl: true,
					rating: true,
					isArchived: true,
				},
				with: {
					organization: { columns: { name: true } },
				},
			},
			createdBy: {
				columns: { id: true, displayName: true },
			},
			confirmations: {
				columns: {
					id: true,
					teamId: true,
					status: true,
					disputeReason: true,
					confirmedByUserId: true,
					confirmedAt: true,
					updatedAt: true,
				},
				with: {
					team: {
						columns: { id: true, name: true, tag: true },
					},
					confirmedBy: {
						columns: { id: true, displayName: true },
					},
				},
			},
			ocrJobs: {
				columns: {
					id: true,
					scrimId: true,
					screenshotType: true,
					imageUrl: true,
					status: true,
					progressStage: true,
					errorCode: true,
					errorMessage: true,
					retryCount: true,
					submittedByUserId: true,
					providerName: true,
					providerModel: true,
					promptVersion: true,
					runAfter: true,
					processingTimeMs: true,
					confidenceFlags: true,
					validatedOutput: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					updatedAt: true,
				},
				with: {
					submittedBy: {
						columns: { id: true, displayName: true },
					},
				},
				orderBy: [desc(ocrJobTable.createdAt)],
			},
		} as const;

		const pastWhere = cursor
			? and(
					teamFilter,
					inArray(scrimTable.status, [...PAST_STATUSES]),
					lt(scrimTable.createdAt, new Date(cursor))
				)
			: and(teamFilter, inArray(scrimTable.status, [...PAST_STATUSES]));

		const [activeRows, pastRows] = await Promise.all([
			db.query.scrimTable.findMany({
				where: and(teamFilter, inArray(scrimTable.status, [...ACTIVE_STATUSES])),
				with: scrimWith,
				orderBy: [desc(scrimTable.scheduledAt), desc(scrimTable.createdAt)],
			}),
			db.query.scrimTable.findMany({
				where: pastWhere,
				with: scrimWith,
				orderBy: [desc(scrimTable.createdAt)],
				limit: limit + 1,
			}),
		]);

		const hasMore = pastRows.length > limit;
		const pagedPastRows = hasMore ? pastRows.slice(0, limit) : pastRows;
		const nextCursor = hasMore
			? pagedPastRows[pagedPastRows.length - 1].createdAt.toISOString()
			: null;

		return c.json({ data: [...activeRows, ...pagedPastRows].map(mapScrimSummary), nextCursor });
	});

	scrimRoutes.get("/:id", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canAccessScrim(user.id, scrim))) {
			logger.warn(
				{ userId: user.id, scrimId, action: "view-scrim" },
				"permission denied: not a scrim participant"
			);
			return c.json({ error: "You do not have access to this scrim.", reason: "role" }, 403);
		}

		return c.json({ data: mapScrimDetail(scrim) });
	});

	scrimRoutes.post("/", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(CreateScrimSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		if (parsed.output.awayTeamId && parsed.output.awayTeamId === parsed.output.homeTeamId) {
			return c.json({ error: "Home and away teams must be different." }, 400);
		}

		if (!(await verifyTeamManager(parsed.output.homeTeamId, user.id))) {
			return c.json({ error: "You do not have permission to create scrims for this team." }, 403);
		}

		const homeTeamRow = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, parsed.output.homeTeamId),
			columns: { id: true, name: true, tag: true, lifecycleStatus: true },
		});
		if (!homeTeamRow) return c.json({ error: "Home team not found." }, 404);
		if (homeTeamRow.lifecycleStatus !== "active") {
			return c.json({ error: "Your team is not eligible to create scrims." }, 400);
		}

		let awayTeamSnapshot: { name: string; tag: string } | null = null;

		if (parsed.output.awayTeamId) {
			const awayTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, parsed.output.awayTeamId),
				columns: {
					id: true,
					name: true,
					tag: true,
					lifecycleStatus: true,
					isArchived: true,
					isPublic: true,
				},
			});
			if (!awayTeam) return c.json({ error: "Away team not found." }, 404);
			if (awayTeam.lifecycleStatus !== "active" || awayTeam.isArchived || !awayTeam.isPublic) {
				return c.json(
					{ error: "The selected opponent team is not currently accepting scrim requests." },
					422
				);
			}
			awayTeamSnapshot = { name: awayTeam.name, tag: awayTeam.tag };

			const { homeTeamId, awayTeamId } = parsed.output;
			const BLOCKING_STATUSES = ["pending", "accepted", "scheduled", "in_progress"] as const;
			const existingScrim = await db.query.scrimTable.findFirst({
				where: and(
					inArray(scrimTable.status, [...BLOCKING_STATUSES]),
					or(
						and(eq(scrimTable.homeTeamId, homeTeamId), eq(scrimTable.awayTeamId, awayTeamId)),
						and(eq(scrimTable.homeTeamId, awayTeamId), eq(scrimTable.awayTeamId, homeTeamId))
					)
				),
				columns: { id: true },
			});
			if (existingScrim) {
				return c.json(
					{
						error:
							"An active scrim request already exists between these two teams. Settle or cancel it before creating a new one.",
						existingScrimId: existingScrim.id,
					},
					409
				);
			}
		}

		const scrim = await db.transaction(async (tx) => {
			const [inserted] = await tx
				.insert(scrimTable)
				.values({
					homeTeamId: parsed.output.homeTeamId,
					awayTeamId: parsed.output.awayTeamId ?? null,
					status: "pending",
					message: parsed.output.message ?? null,
					scheduledAt: parsed.output.scheduledAt ? new Date(parsed.output.scheduledAt) : null,
					config: parsed.output.config ?? {},
					createdByUserId: user.id,
					homeTeamNameSnapshot: homeTeamRow.name,
					homeTeamTagSnapshot: homeTeamRow.tag,
					awayTeamNameSnapshot: awayTeamSnapshot?.name ?? null,
					awayTeamTagSnapshot: awayTeamSnapshot?.tag ?? null,
				})
				.returning({ id: scrimTable.id });

			const confirmationTeamIds = [
				parsed.output.homeTeamId,
				...(parsed.output.awayTeamId ? [parsed.output.awayTeamId] : []),
			];

			if (confirmationTeamIds.length > 0) {
				await tx.insert(scrimConfirmationTable).values(
					confirmationTeamIds.map((teamId) => ({
						scrimId: inserted.id,
						teamId,
						status: "pending" as const,
					}))
				);
			}

			return inserted;
		});

		const detail = await findScrimWithRelations(scrim.id);
		if (!detail) return c.json({ error: "Scrim not found after creation." }, 500);

		await ensureScrimConversationLifecycle(scrim.id);
		if (detail.awayTeam) {
			await notifyTeamAdmins({
				teamId: detail.awayTeam.id,
				actorUserId: user.id,
				type: "scrim_request",
				title: "New scrim request",
				body: `${detail.homeTeam.name} sent a scrim request for ${toIsoDate(detail.scheduledAt) ?? "an unscheduled slot"}.`,
				scrimId: detail.id,
			});
		}

		return c.json({ data: mapScrimDetail(detail) }, 201);
	});
}

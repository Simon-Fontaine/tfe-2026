import type {
	OcrGameHistoryExtractedResult,
	ScrimDetail,
	ScrimResultDiffBasis,
	ScrimResultRevisionSnapshot,
} from "@scrimflow/shared";
import {
	ResolveScrimDisputeSchema,
	RespondToScrimDisputeSchema,
	SubmitScrimResultSchema,
} from "@scrimflow/shared";
import { desc, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { scrimConfirmationTable, scrimResultRevisionTable, scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { ensureScrimConversationLifecycle } from "@/utils/chat";
import { applyCompletedScrimRating } from "@/utils/rating";
import { verifyTeamManager } from "@/utils/team";
import { canResolveScrimDispute, notifyTeamAdmins } from "./access";
import { mapScrimDetail, publishScrimStatusChanged } from "./detail";
import {
	buildOcrResultSnapshot,
	buildPersistedScrimResultSnapshot,
	buildScrimResultSnapshot,
	createScrimResultChangeSummary,
	deriveSeriesScore,
	hasPersistedScrimResult,
	replaceScrimDetailedResult,
} from "./results";
import { findScrimWithRelations, ScrimWorkflowError } from "./shared";

export function registerScrimResultRoutes(scrimRoutes: Hono<AuthEnv>) {
	scrimRoutes.post("/:id/result", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(SubmitScrimResultSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
		if (
			parsed.output.startedAt &&
			parsed.output.endedAt &&
			new Date(parsed.output.endedAt) < new Date(parsed.output.startedAt)
		) {
			return c.json({ error: "End time cannot be earlier than start time." }, 400);
		}
		if (parsed.output.maps && parsed.output.maps.length > 9) {
			return c.json({ error: "A scrim cannot contain more than 9 maps." }, 400);
		}

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!scrim.awayTeamId) {
			return c.json({ error: "Scrim results require both teams to be assigned." }, 400);
		}
		if (
			parsed.output.reportingTeamId !== scrim.homeTeamId &&
			parsed.output.reportingTeamId !== scrim.awayTeamId
		) {
			return c.json({ error: "The reporting team must participate in this scrim." }, 400);
		}
		if (!(await verifyTeamManager(parsed.output.reportingTeamId, user.id))) {
			return c.json(
				{ error: "Only a manager for the reporting team can submit this result." },
				403
			);
		}
		if (scrim.status === "cancelled" || scrim.status === "completed") {
			return c.json({ error: "This scrim can no longer accept result reports." }, 400);
		}
		if (scrim.status === "pending") {
			return c.json(
				{ error: "Pending scrim requests must be accepted before reporting results." },
				400
			);
		}

		const sourceJob = parsed.output.sourceOcrJobId
			? scrim.ocrJobs.find((job) => job.id === parsed.output.sourceOcrJobId)
			: null;
		const sourceJobValidatedOutput =
			(sourceJob?.validatedOutput as ScrimDetail["ocrJobs"][number]["validatedOutput"]) ?? null;
		if (parsed.output.sourceOcrJobId) {
			if (!sourceJob || !sourceJobValidatedOutput) {
				return c.json(
					{ error: "The selected OCR draft is not available for this scrim anymore." },
					400
				);
			}
			if (sourceJobValidatedOutput.screenshotType !== "game_history") {
				return c.json(
					{
						error:
							"Only game history OCR drafts can prefill reviewed scrim results. Scoreboard OCR stays available as evidence only.",
					},
					400
				);
			}
		}

		const scoreboardSourceJobIds = [
			...new Set(
				(parsed.output.maps ?? []).flatMap((map) =>
					map.scoreboardOcrJobId ? [map.scoreboardOcrJobId] : []
				)
			),
		];
		const scoreboardSourceJobs = scoreboardSourceJobIds.map((jobId) =>
			scrim.ocrJobs.find((job) => job.id === jobId)
		);
		for (const [index, scoreboardSourceJob] of scoreboardSourceJobs.entries()) {
			const scoreboardJobId = scoreboardSourceJobIds[index];
			const scoreboardValidatedOutput =
				(scoreboardSourceJob?.validatedOutput as ScrimDetail["ocrJobs"][number]["validatedOutput"]) ??
				null;

			if (!scoreboardSourceJob || !scoreboardValidatedOutput) {
				return c.json(
					{
						error: `The selected scoreboard OCR draft ${scoreboardJobId} is no longer available for this scrim.`,
					},
					400
				);
			}
			if (scoreboardValidatedOutput.screenshotType !== "scoreboard") {
				return c.json(
					{
						error: "Only scoreboard OCR drafts can be attached as map-level player-stat evidence.",
					},
					400
				);
			}
		}

		let resolvedHomeMapScore = parsed.output.homeMapScore;
		let resolvedAwayMapScore = parsed.output.awayMapScore;

		if (parsed.output.maps && parsed.output.maps.length > 0) {
			const derivedSeriesScore = deriveSeriesScore(parsed.output.maps);
			if (
				parsed.output.homeMapScore !== derivedSeriesScore.homeMapScore ||
				parsed.output.awayMapScore !== derivedSeriesScore.awayMapScore
			) {
				return c.json(
					{
						error:
							"Series score must match the reviewed map results. Adjust the map rows or the final score before submitting.",
					},
					400
				);
			}

			resolvedHomeMapScore = derivedSeriesScore.homeMapScore;
			resolvedAwayMapScore = derivedSeriesScore.awayMapScore;
		}

		const resultStartedAtDate = parsed.output.startedAt
			? new Date(parsed.output.startedAt)
			: scrim.startedAt;
		const resultEndedAtDate = parsed.output.endedAt
			? new Date(parsed.output.endedAt)
			: scrim.endedAt;
		const reviewedSnapshot = buildScrimResultSnapshot({
			homeMapScore: resolvedHomeMapScore,
			awayMapScore: resolvedAwayMapScore,
			startedAt: resultStartedAtDate?.toISOString() ?? null,
			endedAt: resultEndedAtDate?.toISOString() ?? null,
			maps: (parsed.output.maps ?? []).map((map, index) => ({
				mapOrder: index + 1,
				mapName: map.mapName,
				mapType: map.mapType ?? "unknown",
				scoreboardOcrJobId: map.scoreboardOcrJobId ?? null,
				homeScore: map.homeScore,
				awayScore: map.awayScore,
				durationSeconds: map.durationSeconds ?? null,
				players: map.players.map((player) => ({
					playerName: player.playerName,
					side: player.side,
					hero: player.hero ?? null,
					role: player.role ?? null,
					eliminations: player.eliminations ?? null,
					assists: player.assists ?? null,
					deaths: player.deaths ?? null,
					damage: player.damage ?? null,
					healing: player.healing ?? null,
					mitigation: player.mitigation ?? null,
				})),
			})),
		});

		await db.transaction(async (tx) => {
			await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

			const latestRevision = await tx.query.scrimResultRevisionTable.findFirst({
				where: eq(scrimResultRevisionTable.scrimId, scrimId),
				columns: {
					revisionNumber: true,
					snapshot: true,
				},
				orderBy: [desc(scrimResultRevisionTable.revisionNumber)],
			});

			const diffBasis: ScrimResultDiffBasis =
				sourceJobValidatedOutput?.screenshotType === "game_history"
					? "ocr_job"
					: latestRevision
						? "previous_revision"
						: hasPersistedScrimResult(scrim)
							? "existing_result"
							: "manual_baseline";
			const comparisonSnapshot =
				sourceJobValidatedOutput?.screenshotType === "game_history"
					? buildOcrResultSnapshot(sourceJobValidatedOutput as OcrGameHistoryExtractedResult)
					: latestRevision
						? (latestRevision.snapshot as ScrimResultRevisionSnapshot)
						: hasPersistedScrimResult(scrim)
							? buildPersistedScrimResultSnapshot(scrim)
							: buildScrimResultSnapshot({
									homeMapScore: 0,
									awayMapScore: 0,
									startedAt: null,
									endedAt: null,
									maps: [],
								});
			const changeSummary = createScrimResultChangeSummary(
				diffBasis,
				comparisonSnapshot,
				reviewedSnapshot
			);

			await tx
				.update(scrimTable)
				.set({
					homeMapScore: resolvedHomeMapScore,
					awayMapScore: resolvedAwayMapScore,
					startedAt: resultStartedAtDate,
					endedAt: resultEndedAtDate,
					status: "awaiting_confirmation",
					disputeResolution: null,
					disputeResolvedByUserId: null,
					disputeResolvedAt: null,
					disputeNotes: null,
				})
				.where(eq(scrimTable.id, scrimId));

			await replaceScrimDetailedResult(tx, {
				scrimId,
				homeTeamId: scrim.homeTeamId,
				awayTeamId: scrim.awayTeamId,
				sourceOcrJobId: parsed.output.sourceOcrJobId ?? null,
				maps: parsed.output.maps ?? [],
			});

			await tx
				.update(scrimConfirmationTable)
				.set({
					status: "pending",
					disputeReason: null,
					confirmedByUserId: null,
					confirmedAt: null,
					updatedAt: new Date(),
				})
				.where(eq(scrimConfirmationTable.scrimId, scrimId));

			await tx.insert(scrimResultRevisionTable).values({
				scrimId,
				revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
				reportingTeamId: parsed.output.reportingTeamId,
				submittedByUserId: user.id,
				sourceOcrJobId: parsed.output.sourceOcrJobId ?? null,
				homeMapScore: reviewedSnapshot.homeMapScore,
				awayMapScore: reviewedSnapshot.awayMapScore,
				startedAt: resultStartedAtDate,
				endedAt: resultEndedAtDate,
				snapshot: reviewedSnapshot,
				changeSummary,
			});
		});

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after result submission." }, 500);

		publishScrimStatusChanged(scrimId, detail.status);
		await ensureScrimConversationLifecycle(scrimId);

		const opposingTeamId =
			parsed.output.reportingTeamId === scrim.homeTeamId ? scrim.awayTeamId : scrim.homeTeamId;
		const reportingTeamName =
			parsed.output.reportingTeamId === scrim.homeTeamId
				? detail.homeTeam.name
				: (detail.awayTeam?.name ?? "Opponent");

		if (opposingTeamId) {
			try {
				await notifyTeamAdmins({
					teamId: opposingTeamId,
					actorUserId: user.id,
					type: "scrim_result_reported",
					title: "Scrim result submitted",
					body: `${reportingTeamName} submitted results for your confirmation.`,
					scrimId,
				});
			} catch (err) {
				console.error("Failed to notify opposing team admins of result report:", err);
			}
		}

		return c.json({ data: mapScrimDetail(detail) });
	});

	scrimRoutes.post("/:id/resolve-dispute", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(ResolveScrimDisputeSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (!(await canResolveScrimDispute(user.id, scrim))) {
			return c.json(
				{ error: "Only organization managers for the participating teams can resolve disputes." },
				403
			);
		}

		try {
			await db.transaction(async (tx) => {
				const now = new Date();

				await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

				const lockedScrim = await tx.query.scrimTable.findFirst({
					where: eq(scrimTable.id, scrimId),
					columns: {
						id: true,
						status: true,
						awayTeamId: true,
					},
				});

				if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
				if (lockedScrim.status !== "disputed") {
					throw new ScrimWorkflowError(400, "Only disputed scrims can be resolved here.");
				}
				if (!lockedScrim.awayTeamId) {
					throw new ScrimWorkflowError(400, "Dispute resolution requires both teams.");
				}

				if (parsed.output.action === "confirm_reported_result") {
					await tx
						.update(scrimTable)
						.set({
							disputeResolution: "admin_resolved",
							disputeResolvedByUserId: user.id,
							disputeResolvedAt: now,
							disputeNotes: parsed.output.notes ?? null,
						})
						.where(eq(scrimTable.id, scrimId));

					await applyCompletedScrimRating(tx, scrimId);
					return;
				}

				await tx
					.update(scrimTable)
					.set({
						status: "cancelled",
						disputeResolution: "voided",
						disputeResolvedByUserId: user.id,
						disputeResolvedAt: now,
						disputeNotes: parsed.output.notes ?? null,
					})
					.where(eq(scrimTable.id, scrimId));
			});
		} catch (error) {
			if (error instanceof ScrimWorkflowError) {
				return c.json({ error: error.message }, { status: error.status as 400 | 404 });
			}

			throw error;
		}

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after dispute resolution." }, 500);

		publishScrimStatusChanged(scrimId, detail.status);
		await ensureScrimConversationLifecycle(scrimId);

		await Promise.all(
			[detail.homeTeam.id, detail.awayTeam?.id ?? null]
				.filter((teamId): teamId is string => !!teamId)
				.map((teamId) =>
					notifyTeamAdmins({
						teamId,
						actorUserId: user.id,
						type: "scrim_resolved",
						title: "Scrim dispute resolved",
						body:
							parsed.output.action === "confirm_reported_result"
								? `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was finalized from the disputed report.`
								: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was voided after dispute review.`,
						scrimId: detail.id,
					})
				)
		);

		return c.json({ data: mapScrimDetail(detail) });
	});

	scrimRoutes.post("/:id/dispute-respond", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(RespondToScrimDisputeSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);

		const lastRevision = scrim.resultRevisions[0] ?? null;
		if (!lastRevision) {
			return c.json({ error: "No result has been reported for this scrim." }, 400);
		}
		if (lastRevision.reportingTeamId !== parsed.output.reportingTeamId) {
			return c.json({ error: "Only the reporting team can respond to this dispute." }, 403);
		}
		if (!(await verifyTeamManager(parsed.output.reportingTeamId, user.id))) {
			return c.json(
				{ error: "Only a manager for the reporting team can respond to this dispute." },
				403
			);
		}

		try {
			await db.transaction(async (tx) => {
				await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

				const lockedScrim = await tx.query.scrimTable.findFirst({
					where: eq(scrimTable.id, scrimId),
					columns: { id: true, status: true, disputeResponse: true },
				});

				if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
				if (lockedScrim.status !== "disputed") {
					throw new ScrimWorkflowError(400, "Only disputed scrims can receive a dispute response.");
				}
				if (lockedScrim.disputeResponse !== null) {
					throw new ScrimWorkflowError(409, "A dispute response has already been submitted.");
				}

				await tx
					.update(scrimTable)
					.set({
						disputeResponse: parsed.output.responseText,
						disputeRespondedAt: new Date(),
						disputeRespondedByUserId: user.id,
					})
					.where(eq(scrimTable.id, scrimId));
			});
		} catch (error) {
			if (error instanceof ScrimWorkflowError) {
				return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
			}
			throw error;
		}

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after dispute response." }, 500);

		return c.json({ data: mapScrimDetail(detail) });
	});
}

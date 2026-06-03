import type { ScrimResultRevisionSnapshot } from "@scrimflow/shared";
import { ApplyScrimMapPlayerStatsSchema } from "@scrimflow/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { scrimMapTable, scrimPlayerStatTable, scrimResultRevisionTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { verifyTeamManager } from "@/utils/team";
import {
	getScrimParticipantTeamIdsFromIds,
	mapScrimDetail,
	publishScrimStatusChanged,
} from "./detail";
import {
	assertRosterLinksValid,
	buildPersistedScrimResultSnapshot,
	buildPlayerStatRows,
	createScrimResultChangeSummary,
} from "./results";
import {
	fetchMapImagesByName,
	findScrimWithRelations,
	isLockTimeoutError,
	ScrimWorkflowError,
	setScrimLockTimeout,
} from "./shared";

const LOCK_TIMEOUT_RETRY_MESSAGE = "Temporarily unavailable, please try again.";

// Stats stay editable after completion; only states without persisted maps are excluded.
const STAT_EDITABLE_STATUSES = new Set(["awaiting_confirmation", "disputed", "completed"]);

export function registerScrimMapStatsRoutes(scrimRoutes: Hono<AuthEnv>) {
	scrimRoutes.post("/:id/maps/:mapId/player-stats", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const mapId = c.req.param("mapId");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(ApplyScrimMapPlayerStatsSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

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
			return c.json({ error: "Only a manager for the reporting team can save player stats." }, 403);
		}
		if (!STAT_EDITABLE_STATUSES.has(scrim.status)) {
			return c.json(
				{ error: "Player stats can only be saved after a result has been reported." },
				400
			);
		}

		const targetMap = scrim.maps.find((map) => map.id === mapId);
		if (!targetMap) {
			return c.json({ error: "Target map not found or does not belong to this scrim." }, 404);
		}

		// Reporting-team rows must each be linked; opponent rows may be linked or
		// manual. Either way a roster member can't appear twice on the same side.
		const reportingSide = parsed.output.reportingTeamId === scrim.homeTeamId ? "home" : "away";
		const linkedKeys = new Set<string>();
		for (const [index, player] of parsed.output.players.entries()) {
			if (player.side === reportingSide && !player.userId) {
				return c.json(
					{
						error: `Player ${index + 1} (${player.playerName}) must be linked to a roster player.`,
					},
					400
				);
			}
			if (player.userId) {
				const key = `${player.side}:${player.userId}`;
				if (linkedKeys.has(key)) {
					return c.json({ error: "Each roster player can only be linked once per map." }, 400);
				}
				linkedKeys.add(key);
			}
		}

		const scoreboardJobId = parsed.output.scoreboardOcrJobId ?? null;
		if (scoreboardJobId) {
			const scoreboardJob = scrim.ocrJobs.find((job) => job.id === scoreboardJobId);
			const validatedOutput = scoreboardJob?.validatedOutput as
				| { screenshotType?: string }
				| null
				| undefined;
			if (!scoreboardJob || !validatedOutput) {
				return c.json(
					{ error: "The selected scoreboard scan is no longer available for this scrim." },
					400
				);
			}
			if (validatedOutput.screenshotType !== "scoreboard") {
				return c.json({ error: "Only scoreboard scans can back map-level player stats." }, 400);
			}
			if (scoreboardJob.status !== "completed" && scoreboardJob.status !== "requires_review") {
				return c.json({ error: "The selected scoreboard scan is not ready to apply." }, 400);
			}
			if (scoreboardJob.scrimMapId && scoreboardJob.scrimMapId !== mapId) {
				return c.json({ error: "This scoreboard scan belongs to a different map." }, 400);
			}
		}

		try {
			await assertRosterLinksValid({
				players: parsed.output.players,
				homeTeamId: scrim.homeTeamId,
				awayTeamId: scrim.awayTeamId,
				labelFor: (index) => `Player ${index + 1}`,
			});
		} catch (error) {
			if (error instanceof ScrimWorkflowError) {
				return c.json({ error: error.message }, { status: error.status as 400 });
			}
			throw error;
		}

		// `after` clones the current snapshot with the target map's players/scoreboard replaced.
		const beforeSnapshot = buildPersistedScrimResultSnapshot(scrim);
		const afterSnapshot: ScrimResultRevisionSnapshot = {
			...beforeSnapshot,
			maps: beforeSnapshot.maps.map((snapshotMap, index) => {
				if (scrim.maps[index]?.id !== mapId) return snapshotMap;
				return {
					...snapshotMap,
					scoreboardOcrJobId: scoreboardJobId,
					players: parsed.output.players.map((player) => ({
						userId: player.userId ?? null,
						playerName: player.playerName,
						side: player.side,
						hero: player.hero,
						role: player.role,
						eliminations: player.eliminations,
						assists: player.assists,
						deaths: player.deaths,
						damage: player.damage,
						healing: player.healing,
						mitigation: player.mitigation,
					})),
				};
			}),
		};
		const changeSummary = createScrimResultChangeSummary(
			"scoreboard_stats",
			beforeSnapshot,
			afterSnapshot
		);

		try {
			await db.transaction(async (tx) => {
				await setScrimLockTimeout(tx);
				await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

				await tx.delete(scrimPlayerStatTable).where(eq(scrimPlayerStatTable.scrimMapId, mapId));

				const playerRows = buildPlayerStatRows({
					scrimMapId: mapId,
					homeTeamId: scrim.homeTeamId,
					awayTeamId: scrim.awayTeamId,
					players: parsed.output.players,
				});
				if (playerRows.length > 0) {
					await tx.insert(scrimPlayerStatTable).values(playerRows);
				}

				await tx
					.update(scrimMapTable)
					.set({ ocrJobId: scoreboardJobId })
					.where(and(eq(scrimMapTable.id, mapId), eq(scrimMapTable.scrimId, scrimId)));

				const latestRevision = await tx.query.scrimResultRevisionTable.findFirst({
					where: eq(scrimResultRevisionTable.scrimId, scrimId),
					columns: { revisionNumber: true },
					orderBy: [desc(scrimResultRevisionTable.revisionNumber)],
				});

				await tx.insert(scrimResultRevisionTable).values({
					scrimId,
					revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
					reportingTeamId: parsed.output.reportingTeamId,
					submittedByUserId: user.id,
					sourceOcrJobId: null,
					homeMapScore: scrim.homeMapScore,
					awayMapScore: scrim.awayMapScore,
					startedAt: scrim.startedAt,
					endedAt: scrim.endedAt,
					snapshot: afterSnapshot,
					changeSummary,
				});
			});
		} catch (error) {
			if (isLockTimeoutError(error)) {
				return c.json({ error: LOCK_TIMEOUT_RETRY_MESSAGE }, 503);
			}
			throw error;
		}

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after saving player stats." }, 500);

		publishScrimStatusChanged(scrimId, detail.status, {
			teamIds: getScrimParticipantTeamIdsFromIds(detail),
			changeType: "result",
		});

		const mapImagesByName = await fetchMapImagesByName(detail.maps.map((m) => m.mapName));
		return c.json({ data: mapScrimDetail(detail, mapImagesByName) });
	});
}

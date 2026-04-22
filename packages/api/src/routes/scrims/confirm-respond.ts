import { ConfirmScrimSchema, RespondToScrimSchema } from "@scrimflow/shared";
import { eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import * as v from "valibot";
import { db } from "@/db";
import { scrimConfirmationTable, scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { ensureScrimConversationLifecycle } from "@/utils/chat";
import { applyCompletedScrimRating } from "@/utils/rating";
import { verifyTeamManager } from "@/utils/team";
import { canManageAnyScrimTeam, notifyTeamAdmins, resolveScrimStatus } from "./access";
import { mapScrimDetail } from "./detail";
import { findScrimWithRelations, ScrimWorkflowError } from "./shared";

export function registerScrimConfirmRespondRoutes(scrimRoutes: Hono<AuthEnv>) {
	scrimRoutes.post("/:id/confirm", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(ConfirmScrimSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
		if (parsed.output.status === "disputed" && !parsed.output.disputeReason) {
			return c.json({ error: "A dispute reason is required when disputing a result." }, 400);
		}

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (![scrim.homeTeamId, scrim.awayTeamId].includes(parsed.output.teamId)) {
			return c.json({ error: "This team is not part of the scrim." }, 400);
		}
		if (!(await verifyTeamManager(parsed.output.teamId, user.id))) {
			return c.json({ error: "You do not have permission to confirm results for this team." }, 403);
		}

		try {
			await db.transaction(async (tx) => {
				await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

				const lockedScrim = await tx.query.scrimTable.findFirst({
					where: eq(scrimTable.id, scrimId),
					columns: {
						id: true,
						homeTeamId: true,
						awayTeamId: true,
						status: true,
					},
					with: {
						confirmations: {
							columns: {
								teamId: true,
								status: true,
							},
						},
					},
				});

				if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
				if (![lockedScrim.homeTeamId, lockedScrim.awayTeamId].includes(parsed.output.teamId)) {
					throw new ScrimWorkflowError(400, "This team is not part of the scrim.");
				}
				if (lockedScrim.status === "cancelled") {
					throw new ScrimWorkflowError(400, "Cancelled scrims cannot be confirmed.");
				}
				if (lockedScrim.status === "completed") {
					throw new ScrimWorkflowError(
						400,
						"Completed scrims are locked once ratings have been applied."
					);
				}
				if (lockedScrim.status !== "awaiting_confirmation" && lockedScrim.status !== "disputed") {
					throw new ScrimWorkflowError(
						400,
						"Scrim confirmations are only available after a result has been reported."
					);
				}
				if (!lockedScrim.awayTeamId) {
					throw new ScrimWorkflowError(400, "Scrim confirmations require both teams.");
				}

				await tx
					.insert(scrimConfirmationTable)
					.values({
						scrimId,
						teamId: parsed.output.teamId,
						status: parsed.output.status,
						disputeReason:
							parsed.output.status === "disputed" ? (parsed.output.disputeReason ?? null) : null,
						confirmedByUserId: user.id,
						confirmedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: [scrimConfirmationTable.scrimId, scrimConfirmationTable.teamId],
						set: {
							status: parsed.output.status,
							disputeReason:
								parsed.output.status === "disputed" ? (parsed.output.disputeReason ?? null) : null,
							confirmedByUserId: user.id,
							confirmedAt: new Date(),
							updatedAt: new Date(),
						},
					});

				const confirmations = await tx.query.scrimConfirmationTable.findMany({
					where: eq(scrimConfirmationTable.scrimId, scrimId),
					columns: {
						teamId: true,
						status: true,
					},
				});

				const nextStatus = resolveScrimStatus(confirmations, [
					lockedScrim.homeTeamId,
					lockedScrim.awayTeamId,
				]);

				if (nextStatus === "completed") {
					await tx
						.update(scrimTable)
						.set({
							disputeResolution: null,
							disputeResolvedByUserId: null,
							disputeResolvedAt: null,
							disputeNotes: null,
						})
						.where(eq(scrimTable.id, scrimId));

					await applyCompletedScrimRating(tx, scrimId);
					return;
				}

				await tx
					.update(scrimTable)
					.set({
						status: nextStatus,
						disputeResolution: nextStatus === "disputed" ? "pending" : null,
						disputeResolvedByUserId: null,
						disputeResolvedAt: null,
						disputeNotes: null,
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
		if (!detail) return c.json({ error: "Scrim not found after status update." }, 500);

		if (parsed.output.status === "disputed") {
			await Promise.all(
				[detail.homeTeam.id, detail.awayTeam?.id ?? null]
					.filter((teamId): teamId is string => !!teamId)
					.map((teamId) =>
						notifyTeamAdmins({
							teamId,
							actorUserId: user.id,
							type: "scrim_disputed",
							title: "Scrim result disputed",
							body: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} was disputed and now needs org-level resolution.`,
							scrimId: detail.id,
						})
					)
			);
		}

		return c.json({ data: mapScrimDetail(detail) });
	});

	scrimRoutes.post("/:id/respond", async (c) => {
		const user = c.get("user");
		const scrimId = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		if (!body) return c.json({ error: "Invalid request body." }, 400);

		const parsed = v.safeParse(RespondToScrimSchema, body);
		if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

		const scrim = await findScrimWithRelations(scrimId);
		if (!scrim) return c.json({ error: "Scrim not found." }, 404);
		if (scrim.status === "completed") {
			return c.json({ error: "Completed scrims cannot be changed." }, 400);
		}

		if (parsed.output.action === "accept") {
			if (!scrim.awayTeamId) {
				return c.json({ error: "This scrim request does not have an opponent yet." }, 400);
			}
			if (!(await verifyTeamManager(scrim.awayTeamId, user.id))) {
				return c.json({ error: "Only the away team can accept this scrim request." }, 403);
			}
			if (scrim.status !== "pending") {
				return c.json({ error: "Only pending scrim requests can be accepted." }, 400);
			}

			await db
				.update(scrimTable)
				.set({
					status: parsed.output.scheduledAt || scrim.scheduledAt ? "scheduled" : "accepted",
					scheduledAt: parsed.output.scheduledAt
						? new Date(parsed.output.scheduledAt)
						: scrim.scheduledAt,
				})
				.where(eq(scrimTable.id, scrimId));
		} else {
			if (!(await canManageAnyScrimTeam(user.id, scrim))) {
				return c.json({ error: "Only a team manager can cancel this scrim." }, 403);
			}
			if (scrim.status === "awaiting_confirmation" || scrim.status === "disputed") {
				return c.json(
					{
						error:
							"Once results have been reported, this scrim must be settled through confirmations or dispute resolution.",
					},
					400
				);
			}
			if (scrim.status === "cancelled") {
				return c.json({ error: "This scrim is already cancelled." }, 400);
			}

			await db.update(scrimTable).set({ status: "cancelled" }).where(eq(scrimTable.id, scrimId));
		}

		await ensureScrimConversationLifecycle(scrimId);

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after update." }, 500);

		if (parsed.output.action === "accept") {
			await notifyTeamAdmins({
				teamId: detail.homeTeam.id,
				actorUserId: user.id,
				type: "scrim_accepted",
				title: "Scrim request accepted",
				body: `${detail.awayTeam?.name ?? "The opponent"} accepted your scrim request.`,
				scrimId: detail.id,
			});
		} else {
			await Promise.all(
				[detail.homeTeam.id, detail.awayTeam?.id ?? null]
					.filter((teamId): teamId is string => !!teamId)
					.map((teamId) =>
						notifyTeamAdmins({
							teamId,
							actorUserId: user.id,
							type: "scrim_cancelled",
							title: "Scrim cancelled",
							body: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} has been cancelled.`,
							scrimId: detail.id,
						})
					)
			);
		}

		return c.json({ data: mapScrimDetail(detail) });
	});
}

import { ConfirmScrimSchema, RespondToScrimSchema } from "@scrimflow/shared";
import { eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { DatabaseError } from "pg";
import * as v from "valibot";
import { writeDomainAuditEvent } from "@/auth/domain-audit";
import { db } from "@/db";
import { scrimConfirmationTable, scrimNegotiationRevisionTable, scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";
import { ensureScrimConversationLifecycle } from "@/utils/chat";
import { applyCompletedScrimRating } from "@/utils/rating";
import { verifyTeamManager } from "@/utils/team";
import { canManageAnyScrimTeam, notifyTeamAdmins, resolveScrimStatus } from "./access";
import { mapScrimDetail, publishScrimStatusChanged } from "./detail";
import { findScrimWithRelations, ScrimWorkflowError } from "./shared";

const SCRIM_LOCK_TIMEOUT_MS = 5000;

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
				await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
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
					throw new ScrimWorkflowError(409, "This scrim result has already been confirmed.");
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
				return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
			}
			if (error instanceof DatabaseError && error.code === "55P03") {
				return c.json({ error: "Temporarily unavailable, please try again." }, 503);
			}
			throw error;
		}

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after status update." }, 500);

		publishScrimStatusChanged(scrimId, detail.status);
		await ensureScrimConversationLifecycle(scrimId);

		if (parsed.output.status === "disputed") {
			writeDomainAuditEvent({
				actorId: user.id,
				actorType: "user",
				domain: "result",
				actionType: "dispute_initiated",
				targetType: "scrim",
				targetId: scrimId,
				outcome: "success",
				reason: parsed.output.disputeReason ?? null,
				linkedScrimId: scrimId,
			});
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

		// Auto-expire pending scrims older than 7 days before processing any action.
		if (scrim.status === "pending") {
			const PENDING_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
			if (Date.now() - scrim.createdAt.getTime() > PENDING_EXPIRY_MS) {
				try {
					await db.transaction(async (tx) => {
						await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
						await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);
						const lockedScrim = await tx.query.scrimTable.findFirst({
							where: eq(scrimTable.id, scrimId),
							columns: { id: true, status: true },
						});
						if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
						if (lockedScrim.status !== "pending") {
							throw new ScrimWorkflowError(
								409,
								"This scrim request has already been updated. Refresh to see the current state."
							);
						}
						await tx
							.update(scrimTable)
							.set({ status: "cancelled" })
							.where(eq(scrimTable.id, scrimId));
						await tx.insert(scrimNegotiationRevisionTable).values({
							scrimId,
							actorUserId: null,
							actorTeamId: null,
							action: "expired",
							priorScheduledAt: scrim.scheduledAt,
							proposedScheduledAt: null,
							priorConfig: scrim.config,
							proposedConfig: null,
							priorMessage: scrim.message,
							proposedMessage: null,
						});
					});
					const expiredDetail = await findScrimWithRelations(scrimId);
					if (expiredDetail) {
						await Promise.all(
							[expiredDetail.homeTeam.id, expiredDetail.awayTeam?.id ?? null]
								.filter((teamId): teamId is string => !!teamId)
								.map((teamId) =>
									notifyTeamAdmins({
										teamId,
										actorUserId: user.id,
										type: "scrim_cancelled",
										title: "Scrim request expired",
										body: `The scrim request for ${expiredDetail.homeTeam.name}${expiredDetail.awayTeam ? ` vs ${expiredDetail.awayTeam.name}` : ""} has expired and been cancelled.`,
										scrimId: expiredDetail.id,
									})
								)
						);
					}
					await ensureScrimConversationLifecycle(scrimId);
					publishScrimStatusChanged(scrimId, "cancelled");
					return c.json({ error: "This scrim request has expired and has been cancelled." }, 409);
				} catch (error) {
					if (error instanceof ScrimWorkflowError) {
						return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
					}
					if (error instanceof DatabaseError && error.code === "55P03") {
						return c.json({ error: "Temporarily unavailable, please try again." }, 503);
					}
					throw error;
				}
			}
		}

		const action = parsed.output.action;
		let rescheduleIsHomeTeamActor = false;
		let cancelActorTeamId: string = scrim.homeTeamId;

		if (action === "accept") {
			if (!scrim.awayTeamId) {
				return c.json({ error: "This scrim request does not have an opponent yet." }, 400);
			}
			if (!(await verifyTeamManager(scrim.awayTeamId, user.id))) {
				return c.json({ error: "Only the away team can accept this scrim request." }, 403);
			}
			if (scrim.status !== "pending") {
				return c.json({ error: "Only pending scrim requests can be accepted." }, 400);
			}

			const acceptedScheduledAt = parsed.output.scheduledAt
				? new Date(parsed.output.scheduledAt)
				: scrim.scheduledAt;
			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
					await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);
					const lockedScrim = await tx.query.scrimTable.findFirst({
						where: eq(scrimTable.id, scrimId),
						columns: { id: true, status: true },
					});
					if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
					if (lockedScrim.status !== "pending") {
						throw new ScrimWorkflowError(
							409,
							"This scrim request has already been accepted, declined, or expired. Refresh to see the current state."
						);
					}
					await tx
						.update(scrimTable)
						.set({
							status: acceptedScheduledAt ? "scheduled" : "accepted",
							scheduledAt: acceptedScheduledAt,
						})
						.where(eq(scrimTable.id, scrimId));
					await tx.insert(scrimNegotiationRevisionTable).values({
						scrimId,
						actorUserId: user.id,
						actorTeamId: scrim.awayTeamId,
						action: "accept",
						priorScheduledAt: scrim.scheduledAt,
						proposedScheduledAt: acceptedScheduledAt,
						priorConfig: scrim.config,
						proposedConfig: null,
						priorMessage: scrim.message,
						proposedMessage: null,
					});
				});
			} catch (error) {
				if (error instanceof ScrimWorkflowError) {
					return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
				}
				if (error instanceof DatabaseError && error.code === "55P03") {
					return c.json({ error: "Temporarily unavailable, please try again." }, 503);
				}
				throw error;
			}
		} else if (action === "decline") {
			if (!scrim.awayTeamId) {
				return c.json({ error: "This scrim does not have an opponent to decline." }, 400);
			}
			if (!(await verifyTeamManager(scrim.awayTeamId, user.id))) {
				return c.json({ error: "Only the away team can decline this scrim request." }, 403);
			}
			if (scrim.status !== "pending") {
				return c.json({ error: "Only pending scrim requests can be declined." }, 400);
			}
			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
					await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);
					const lockedScrim = await tx.query.scrimTable.findFirst({
						where: eq(scrimTable.id, scrimId),
						columns: { id: true, status: true },
					});
					if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
					if (lockedScrim.status !== "pending") {
						throw new ScrimWorkflowError(
							409,
							"This scrim request has already been accepted, declined, or expired. Refresh to see the current state."
						);
					}
					await tx
						.update(scrimTable)
						.set({ status: "cancelled" })
						.where(eq(scrimTable.id, scrimId));
					await tx.insert(scrimNegotiationRevisionTable).values({
						scrimId,
						actorUserId: user.id,
						actorTeamId: scrim.awayTeamId,
						action: "decline",
						priorScheduledAt: scrim.scheduledAt,
						proposedScheduledAt: null,
						priorConfig: scrim.config,
						proposedConfig: null,
						priorMessage: scrim.message,
						proposedMessage: null,
					});
				});
			} catch (error) {
				if (error instanceof ScrimWorkflowError) {
					return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
				}
				if (error instanceof DatabaseError && error.code === "55P03") {
					return c.json({ error: "Temporarily unavailable, please try again." }, 503);
				}
				throw error;
			}
		} else if (action === "reschedule") {
			if (!(await canManageAnyScrimTeam(user.id, scrim))) {
				return c.json({ error: "Only a team manager can propose a reschedule." }, 403);
			}
			if (scrim.status !== "accepted" && scrim.status !== "scheduled") {
				return c.json(
					{ error: "Reschedule is only available for accepted or scheduled scrims." },
					400
				);
			}
			if (!parsed.output.scheduledAt) {
				return c.json({ error: "A new proposed time is required for reschedule." }, 400);
			}
			rescheduleIsHomeTeamActor = await verifyTeamManager(scrim.homeTeamId, user.id);
			const actorTeamId = rescheduleIsHomeTeamActor
				? scrim.homeTeamId
				: (scrim.awayTeamId ?? scrim.homeTeamId);
			const newScheduledAt = new Date(parsed.output.scheduledAt);
			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
					await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);
					const lockedScrim = await tx.query.scrimTable.findFirst({
						where: eq(scrimTable.id, scrimId),
						columns: { id: true, status: true },
					});
					if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
					if (lockedScrim.status !== "accepted" && lockedScrim.status !== "scheduled") {
						throw new ScrimWorkflowError(
							409,
							"This scrim has already been updated by another action. Refresh to see the current state."
						);
					}
					await tx
						.update(scrimTable)
						.set({ status: "scheduled", scheduledAt: newScheduledAt })
						.where(eq(scrimTable.id, scrimId));
					await tx.insert(scrimNegotiationRevisionTable).values({
						scrimId,
						actorUserId: user.id,
						actorTeamId,
						action: "reschedule",
						priorScheduledAt: scrim.scheduledAt,
						proposedScheduledAt: newScheduledAt,
						priorConfig: scrim.config,
						proposedConfig: null,
						priorMessage: scrim.message,
						proposedMessage: null,
					});
				});
			} catch (error) {
				if (error instanceof ScrimWorkflowError) {
					return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
				}
				if (error instanceof DatabaseError && error.code === "55P03") {
					return c.json({ error: "Temporarily unavailable, please try again." }, 503);
				}
				throw error;
			}
		} else if (action === "propose_changes") {
			if (!scrim.awayTeamId) {
				return c.json({ error: "This scrim request does not have an opponent yet." }, 400);
			}
			if (!(await verifyTeamManager(scrim.awayTeamId, user.id))) {
				return c.json({ error: "Only the away team can propose changes to a pending scrim." }, 403);
			}
			if (scrim.status !== "pending") {
				return c.json(
					{ error: "Counterproposals are only available for pending scrim requests." },
					400
				);
			}
			const proposedScheduledAt = parsed.output.scheduledAt
				? new Date(parsed.output.scheduledAt)
				: scrim.scheduledAt;
			const proposedConfig = parsed.output.config ?? scrim.config;
			const proposedMessage = parsed.output.message ?? scrim.message;
			await db.transaction(async (tx) => {
				await tx
					.update(scrimTable)
					.set({
						scheduledAt: proposedScheduledAt,
						config: proposedConfig,
						message: proposedMessage ?? null,
					})
					.where(eq(scrimTable.id, scrimId));
				await tx.insert(scrimNegotiationRevisionTable).values({
					scrimId,
					actorUserId: user.id,
					actorTeamId: scrim.awayTeamId,
					action: "propose_changes",
					priorScheduledAt: scrim.scheduledAt,
					proposedScheduledAt: parsed.output.scheduledAt ? proposedScheduledAt : null,
					priorConfig: scrim.config,
					proposedConfig: parsed.output.config ?? null,
					priorMessage: scrim.message,
					proposedMessage: parsed.output.message ?? null,
				});
			});
		} else if (action === "start") {
			if (!(await canManageAnyScrimTeam(user.id, scrim))) {
				return c.json({ error: "Only a team manager can mark this scrim as in progress." }, 403);
			}
			if (scrim.status !== "accepted" && scrim.status !== "scheduled") {
				return c.json(
					{ error: "Only accepted or scheduled scrims can be marked as in progress." },
					400
				);
			}
			if (!scrim.awayTeamId) {
				return c.json({ error: "Both teams must be assigned before the scrim can start." }, 400);
			}
			const isHomeTeamActor = await verifyTeamManager(scrim.homeTeamId, user.id);
			const startActorTeamId = isHomeTeamActor ? scrim.homeTeamId : scrim.awayTeamId;
			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
					await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);
					const lockedScrim = await tx.query.scrimTable.findFirst({
						where: eq(scrimTable.id, scrimId),
						columns: { id: true, status: true },
					});
					if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
					if (lockedScrim.status !== "accepted" && lockedScrim.status !== "scheduled") {
						throw new ScrimWorkflowError(
							409,
							"This scrim has already been updated by another action. Refresh to see the current state."
						);
					}
					await tx
						.update(scrimTable)
						.set({ status: "in_progress" })
						.where(eq(scrimTable.id, scrimId));
					await tx.insert(scrimNegotiationRevisionTable).values({
						scrimId,
						actorUserId: user.id,
						actorTeamId: startActorTeamId,
						action: "start",
						priorScheduledAt: scrim.scheduledAt,
						proposedScheduledAt: null,
						priorConfig: scrim.config,
						proposedConfig: null,
						priorMessage: scrim.message,
						proposedMessage: null,
					});
				});
			} catch (error) {
				if (error instanceof ScrimWorkflowError) {
					return c.json({ error: error.message }, { status: error.status as 400 | 404 | 409 });
				}
				if (error instanceof DatabaseError && error.code === "55P03") {
					return c.json({ error: "Temporarily unavailable, please try again." }, 503);
				}
				throw error;
			}
		} else {
			// cancel
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
			if (scrim.status === "completed") {
				return c.json({ error: "Completed scrims cannot be changed." }, 400);
			}

			cancelActorTeamId = (await verifyTeamManager(scrim.homeTeamId, user.id))
				? scrim.homeTeamId
				: (scrim.awayTeamId ?? scrim.homeTeamId);

			try {
				await db.transaction(async (tx) => {
					await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${SCRIM_LOCK_TIMEOUT_MS}ms'`));
					await tx.execute(sql`select id from scrim where id = ${scrimId} for update`);

					const lockedScrim = await tx.query.scrimTable.findFirst({
						where: eq(scrimTable.id, scrimId),
						columns: {
							id: true,
							status: true,
							homeTeamId: true,
							awayTeamId: true,
							scheduledAt: true,
							config: true,
							message: true,
						},
					});

					if (!lockedScrim) throw new ScrimWorkflowError(404, "Scrim not found.");
					if (lockedScrim.status === "awaiting_confirmation" || lockedScrim.status === "disputed") {
						throw new ScrimWorkflowError(
							400,
							"Once results have been reported, this scrim must be settled through confirmations or dispute resolution."
						);
					}
					if (lockedScrim.status === "cancelled") {
						throw new ScrimWorkflowError(400, "This scrim is already cancelled.");
					}
					if (lockedScrim.status === "completed") {
						throw new ScrimWorkflowError(400, "Completed scrims cannot be changed.");
					}

					await tx
						.update(scrimTable)
						.set({ status: "cancelled" })
						.where(eq(scrimTable.id, scrimId));

					await tx.insert(scrimNegotiationRevisionTable).values({
						scrimId,
						actorUserId: user.id,
						actorTeamId: cancelActorTeamId,
						action: "cancel",
						priorScheduledAt: lockedScrim.scheduledAt,
						proposedScheduledAt: null,
						priorConfig: lockedScrim.config,
						proposedConfig: null,
						priorMessage: lockedScrim.message,
						proposedMessage: parsed.output.cancelReason ?? null,
					});
				});
			} catch (error) {
				if (error instanceof ScrimWorkflowError) {
					return c.json({ error: error.message }, { status: error.status as 400 | 404 });
				}
				if (error instanceof DatabaseError && error.code === "55P03") {
					return c.json({ error: "Temporarily unavailable, please try again." }, 503);
				}
				throw error;
			}
		}

		await ensureScrimConversationLifecycle(scrimId);

		const detail = await findScrimWithRelations(scrimId);
		if (!detail) return c.json({ error: "Scrim not found after update." }, 500);

		if (action === "accept") {
			await notifyTeamAdmins({
				teamId: detail.homeTeam.id,
				actorUserId: user.id,
				type: "scrim_accepted",
				title: "Scrim request accepted",
				body: `${detail.awayTeam?.name ?? "The opponent"} accepted your scrim request.`,
				scrimId: detail.id,
			});
		} else if (action === "decline") {
			await notifyTeamAdmins({
				teamId: detail.homeTeam.id,
				actorUserId: user.id,
				type: "scrim_cancelled",
				title: "Scrim request declined",
				body: `${detail.awayTeam?.name ?? "The opponent"} declined your scrim request.`,
				scrimId: detail.id,
			});
		} else if (action === "reschedule") {
			const otherTeamId = rescheduleIsHomeTeamActor ? detail.awayTeam?.id : detail.homeTeam.id;
			if (otherTeamId) {
				await notifyTeamAdmins({
					teamId: otherTeamId,
					actorUserId: user.id,
					type: "scrim_rescheduled",
					title: "Scrim reschedule proposed",
					body: `A new time has been proposed for ${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""}.`,
					scrimId: detail.id,
				});
			}
		} else if (action === "propose_changes") {
			await notifyTeamAdmins({
				teamId: detail.homeTeam.id,
				actorUserId: user.id,
				type: "scrim_rescheduled",
				title: "New scrim terms proposed",
				body: `${detail.awayTeam?.name ?? "The opponent"} proposed updated terms for your scrim request.`,
				scrimId: detail.id,
			});
		} else if (action === "cancel") {
			const cancelActorTeamName =
				cancelActorTeamId === detail.homeTeam.id
					? detail.homeTeam.name
					: (detail.awayTeam?.name ?? detail.homeTeam.name);
			const cancelReasonSuffix = parsed.output.cancelReason
				? ` Reason: ${parsed.output.cancelReason}`
				: "";
			await Promise.all(
				[detail.homeTeam.id, detail.awayTeam?.id ?? null]
					.filter((teamId): teamId is string => !!teamId)
					.map((teamId) =>
						notifyTeamAdmins({
							teamId,
							actorUserId: user.id,
							type: "scrim_cancelled",
							title: "Scrim cancelled",
							body: `${cancelActorTeamName} cancelled the scrim between ${detail.homeTeam.name}${detail.awayTeam ? ` and ${detail.awayTeam.name}` : ""}.${cancelReasonSuffix}`,
							scrimId: detail.id,
						})
					)
			);
		} else if (action === "start") {
			await Promise.all(
				[detail.homeTeam.id, detail.awayTeam?.id ?? null]
					.filter((teamId): teamId is string => !!teamId)
					.map((teamId) =>
						notifyTeamAdmins({
							teamId,
							actorUserId: user.id,
							type: "scrim_started",
							title: "Scrim is now in progress",
							body: `${detail.homeTeam.name}${detail.awayTeam ? ` vs ${detail.awayTeam.name}` : ""} has started. Report results when done.`,
							scrimId: detail.id,
						})
					)
			);
		}

		if (action === "accept") {
			publishScrimStatusChanged(scrimId, detail.status);
		} else if (action === "decline" || action === "cancel") {
			publishScrimStatusChanged(scrimId, "cancelled");
		} else if (action === "reschedule") {
			publishScrimStatusChanged(scrimId, "scheduled");
		} else if (action === "start") {
			publishScrimStatusChanged(scrimId, "in_progress");
		}

		return c.json({ data: mapScrimDetail(detail) });
	});
}

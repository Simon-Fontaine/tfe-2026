import { DecideRecruitmentResponseSchema } from "@scrimflow/shared";
import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { lfgApplicationTable, lfgPostTable, teamTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { extractErrors } from "@/routes/auth/utils";
import {
	canManageRecruitmentPost,
	ensureOrganizationMembership,
	ensureTeamMembership,
	mapRecruitmentResponse,
	sendRecruitmentSystemMessage,
} from "@/utils/recruit";

const responsesRoutes = new Hono<AuthEnv>();

responsesRoutes.get("/mine", async (c) => {
	const user = c.get("user");
	const rows = await db.query.lfgApplicationTable.findMany({
		where: eq(lfgApplicationTable.applicantUserId, user.id),
		with: {
			post: {
				columns: { id: true, type: true, title: true },
			},
			applicant: {
				columns: { id: true, displayName: true, avatarUrl: true },
				with: {
					profile: { columns: { primaryRole: true, rank: true } },
				},
			},
			applicantTeam: { columns: { id: true, name: true, tag: true } },
			applicantOrganization: { columns: { id: true, name: true } },
			chatChannels: { columns: { id: true } },
		},
		orderBy: [lfgApplicationTable.createdAt],
	});

	return c.json({ data: rows.map((row) => mapRecruitmentResponse(row)) });
});

responsesRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const responseId = c.req.param("id");

	const response = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, responseId),
		columns: { id: true, applicantUserId: true, status: true },
	});
	if (!response) return c.json({ error: "Response not found." }, 404);
	if (response.applicantUserId !== user.id)
		return c.json({ error: "This response is not yours." }, 403);
	if (response.status !== "pending")
		return c.json({ error: "This response is no longer active." }, 400);

	await db
		.update(lfgApplicationTable)
		.set({ status: "withdrawn" })
		.where(eq(lfgApplicationTable.id, responseId));

	return c.json({ success: true });
});

responsesRoutes.post("/:id/decision", async (c) => {
	const user = c.get("user");
	const responseId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DecideRecruitmentResponseSchema, { ...body, responseId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const response = await db.query.lfgApplicationTable.findFirst({
		where: eq(lfgApplicationTable.id, responseId),
		with: {
			post: {
				columns: {
					id: true,
					type: true,
					title: true,
					status: true,
					userId: true,
					ownerType: true,
					teamId: true,
					organizationId: true,
					rolesNeeded: true,
					staffRole: true,
				},
			},
			applicant: {
				columns: { id: true },
				with: {
					profile: { columns: { primaryRole: true } },
				},
			},
			applicantTeam: {
				columns: { id: true, organizationId: true },
			},
			applicantOrganization: {
				columns: { id: true },
			},
			chatChannels: { columns: { id: true } },
		},
		columns: {
			id: true,
			postId: true,
			applicantUserId: true,
			applicantTeamId: true,
			applicantOrganizationId: true,
			status: true,
		},
	});
	if (!response?.post) return c.json({ error: "Response not found." }, 404);
	if (response.status !== "pending")
		return c.json({ error: "This response has already been reviewed." }, 400);
	if (!(await canManageRecruitmentPost(response.post, user.id))) {
		return c.json({ error: "You do not have permission to manage this response." }, 403);
	}

	if (parsed.output.action === "reject") {
		await db
			.update(lfgApplicationTable)
			.set({ status: "rejected" })
			.where(eq(lfgApplicationTable.id, response.id));

		await createNotification({
			userId: response.applicantUserId,
			type: "recruitment_rejected",
			title: `Your response to "${response.post.title}" was not accepted.`,
			referenceType: "lfg_application",
			referenceId: response.id,
		});

		if (response.chatChannels[0]) {
			await sendRecruitmentSystemMessage(
				response.chatChannels[0].id,
				"Recruitment response rejected."
			);
		}

		return c.json({ success: true });
	}

	await db.transaction(async (tx) => {
		const preferredGameRole =
			parsed.output.gameRole ??
			(Array.isArray(response.post.rolesNeeded)
				? (response.post.rolesNeeded[0] as "tank" | "damage" | "support" | undefined)
				: undefined) ??
			response.applicant.profile?.primaryRole ??
			null;
		const preferredStaffRole = parsed.output.staffRole ?? response.post.staffRole ?? "staff";

		switch (response.post.type) {
			case "lfp": {
				if (!response.post.teamId || !response.post.organizationId) {
					throw new Error("Team recruitment posts require a team and organisation.");
				}

				await ensureOrganizationMembership(tx, {
					organizationId: response.post.organizationId,
					userId: response.applicantUserId,
					role: "member",
					memberType: "player",
					gameRole: preferredGameRole,
				});
				await ensureTeamMembership(tx, {
					teamId: response.post.teamId,
					userId: response.applicantUserId,
					memberType: "player",
					gameRole: preferredGameRole,
					status: "trial",
				});
				break;
			}
			case "lft": {
				if (!response.applicantTeamId) {
					throw new Error("Team responses are required for LFT posts.");
				}

				const responderTeam = await tx.query.teamTable.findFirst({
					where: eq(teamTable.id, response.applicantTeamId),
					columns: { id: true, organizationId: true },
				});
				if (!responderTeam) throw new Error("Responder team not found.");

				await ensureOrganizationMembership(tx, {
					organizationId: responderTeam.organizationId,
					userId: response.post.userId,
					role: "member",
					memberType: "player",
					gameRole: preferredGameRole,
				});
				await ensureTeamMembership(tx, {
					teamId: responderTeam.id,
					userId: response.post.userId,
					memberType: "player",
					gameRole: preferredGameRole,
					status: "trial",
				});
				break;
			}
			case "lfs": {
				if (
					response.post.ownerType === "team" &&
					response.post.teamId &&
					response.post.organizationId
				) {
					await ensureOrganizationMembership(tx, {
						organizationId: response.post.organizationId,
						userId: response.applicantUserId,
						role: "member",
						memberType: "staff",
						staffRole: preferredStaffRole,
					});
					await ensureTeamMembership(tx, {
						teamId: response.post.teamId,
						userId: response.applicantUserId,
						memberType: "staff",
						staffRole: preferredStaffRole,
						status: "trial",
					});
				} else if (response.post.ownerType === "organization" && response.post.organizationId) {
					await ensureOrganizationMembership(tx, {
						organizationId: response.post.organizationId,
						userId: response.applicantUserId,
						role: "member",
						memberType: "staff",
						staffRole: preferredStaffRole,
					});
				} else if (response.post.ownerType === "player") {
					if (response.applicantTeamId) {
						const responderTeam = await tx.query.teamTable.findFirst({
							where: eq(teamTable.id, response.applicantTeamId),
							columns: { id: true, organizationId: true },
						});
						if (!responderTeam) throw new Error("Responder team not found.");

						await ensureOrganizationMembership(tx, {
							organizationId: responderTeam.organizationId,
							userId: response.post.userId,
							role: "member",
							memberType: "staff",
							staffRole: preferredStaffRole,
						});
						await ensureTeamMembership(tx, {
							teamId: responderTeam.id,
							userId: response.post.userId,
							memberType: "staff",
							staffRole: preferredStaffRole,
							status: "trial",
						});
					} else if (response.applicantOrganizationId) {
						await ensureOrganizationMembership(tx, {
							organizationId: response.applicantOrganizationId,
							userId: response.post.userId,
							role: "member",
							memberType: "staff",
							staffRole: preferredStaffRole,
						});
					}
				}
				break;
			}
			default:
				break;
		}

		await tx
			.update(lfgApplicationTable)
			.set({ status: "accepted" })
			.where(eq(lfgApplicationTable.id, response.id));

		if (response.post.type !== "lfr") {
			await tx
				.update(lfgPostTable)
				.set({ status: "fulfilled" })
				.where(eq(lfgPostTable.id, response.postId));

			await tx
				.update(lfgApplicationTable)
				.set({ status: "rejected" })
				.where(
					and(
						eq(lfgApplicationTable.postId, response.postId),
						ne(lfgApplicationTable.id, response.id)
					)
				);
		}
	});

	await createNotification({
		userId: response.applicantUserId,
		type: "recruitment_accepted",
		title: `Your response to "${response.post.title}" was accepted.`,
		referenceType: "lfg_application",
		referenceId: response.id,
	});

	if (response.chatChannels[0]) {
		await sendRecruitmentSystemMessage(
			response.chatChannels[0].id,
			`Recruitment response accepted for "${response.post.title}".`
		);
	}

	return c.json({ success: true });
});

export { responsesRoutes };

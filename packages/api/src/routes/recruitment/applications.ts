import { DecideRecruitmentApplicationSchema } from "@scrimflow/shared";
import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	chatChannelTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { publishUserRealtimeEvent } from "@/realtime/scrim-hub";
import { extractErrors } from "@/routes/auth/utils";
import {
	canManageRecruitmentListing,
	countManagedPendingApplications,
	ensureOrganizationMembership,
	ensureTeamMembership,
	mapRecruitmentApplication,
	sendRecruitmentSystemMessage,
} from "@/utils/recruit";

const recruitmentApplicationsRoutes = new Hono<AuthEnv>();

recruitmentApplicationsRoutes.get("/pending-count", async (c) => {
	const user = c.get("user");
	const count = await countManagedPendingApplications(user.id);
	return c.json({ data: { count } });
});

recruitmentApplicationsRoutes.get("/mine", async (c) => {
	const user = c.get("user");
	const rows = await db.query.recruitmentApplicationTable.findMany({
		where: eq(recruitmentApplicationTable.applicantUserId, user.id),
		with: {
			listing: {
				columns: { id: true, type: true, title: true },
			},
			applicant: {
				columns: { id: true, username: true, displayName: true, avatarUrl: true },
				with: {
					profile: { columns: { primaryRole: true, rank: true } },
				},
			},
			applicantTeam: { columns: { id: true, name: true, tag: true } },
			applicantOrganization: { columns: { id: true, name: true, slug: true } },
			chatChannels: { columns: { id: true } },
		},
		orderBy: [recruitmentApplicationTable.createdAt],
	});

	return c.json({ data: rows.map((row) => mapRecruitmentApplication(row)) });
});

recruitmentApplicationsRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const applicationId = c.req.param("id");

	const application = await db.query.recruitmentApplicationTable.findFirst({
		where: eq(recruitmentApplicationTable.id, applicationId),
		columns: { id: true, applicantUserId: true, status: true, listingId: true },
		with: {
			listing: { columns: { id: true, userId: true, title: true } },
			chatChannels: { columns: { id: true } },
		},
	});
	if (!application) return c.json({ error: "Application not found." }, 404);
	if (application.applicantUserId !== user.id)
		return c.json({ error: "This application is not yours." }, 403);
	if (application.status !== "pending")
		return c.json({ error: "This application is no longer active." }, 400);

	await db
		.update(recruitmentApplicationTable)
		.set({ status: "withdrawn" })
		.where(eq(recruitmentApplicationTable.id, applicationId));

	const conversationId = application.chatChannels[0]?.id;
	if (conversationId) {
		await db
			.update(chatChannelTable)
			.set({ isArchived: true })
			.where(eq(chatChannelTable.id, conversationId));

		await sendRecruitmentSystemMessage(conversationId, "The applicant withdrew their application.");
	}

	if (application.listing) {
		await createNotification({
			userId: application.listing.userId,
			type: "recruitment_withdrawn",
			title: `An application on "${application.listing.title}" was withdrawn.`,
			referenceType: "recruitment_application",
			referenceId: application.id,
		});

		const pendingCount = await countManagedPendingApplications(application.listing.userId);
		void publishUserRealtimeEvent({
			userId: application.listing.userId,
			event: "recruit:managed-pending-count",
			payload: {
				pendingCount,
			},
		});
	}

	return c.json({ success: true });
});

recruitmentApplicationsRoutes.post("/:id/decision", async (c) => {
	const user = c.get("user");
	const applicationId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(DecideRecruitmentApplicationSchema, { ...body, applicationId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const application = await db.query.recruitmentApplicationTable.findFirst({
		where: eq(recruitmentApplicationTable.id, applicationId),
		with: {
			listing: {
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
			listingId: true,
			applicantUserId: true,
			applicantTeamId: true,
			applicantOrganizationId: true,
			status: true,
		},
	});
	if (!application?.listing) return c.json({ error: "Application not found." }, 404);
	if (application.status !== "pending")
		return c.json({ error: "This application has already been reviewed." }, 400);
	if (!(await canManageRecruitmentListing(application.listing, user.id))) {
		return c.json({ error: "You do not have permission to manage this application." }, 403);
	}

	if (parsed.output.action === "reject") {
		await db
			.update(recruitmentApplicationTable)
			.set({ status: "rejected" })
			.where(eq(recruitmentApplicationTable.id, application.id));

		await createNotification({
			userId: application.applicantUserId,
			type: "recruitment_rejected",
			title: `Your application for "${application.listing.title}" was not accepted.`,
			referenceType: "recruitment_application",
			referenceId: application.id,
		});

		if (application.chatChannels[0]) {
			const conversationId = application.chatChannels[0].id;
			await sendRecruitmentSystemMessage(conversationId, "Recruitment application rejected.");
			await db
				.update(chatChannelTable)
				.set({ isArchived: true })
				.where(eq(chatChannelTable.id, conversationId));
		}

		void publishUserRealtimeEvent({
			userId: application.applicantUserId,
			event: "recruit:application-decided",
			payload: { applicationId: application.id, status: "rejected" },
		});
		const pendingCount = await countManagedPendingApplications(application.listing.userId);
		void publishUserRealtimeEvent({
			userId: application.listing.userId,
			event: "recruit:managed-pending-count",
			payload: {
				pendingCount,
			},
		});

		return c.json({ success: true });
	}

	await db.transaction(async (tx) => {
		const preferredGameRole =
			parsed.output.gameRole ??
			(Array.isArray(application.listing.rolesNeeded)
				? (application.listing.rolesNeeded[0] as "tank" | "damage" | "support" | undefined)
				: undefined) ??
			application.applicant.profile?.primaryRole ??
			null;
		const preferredStaffRole = parsed.output.staffRole ?? application.listing.staffRole ?? "staff";

		switch (application.listing.type) {
			case "lfp": {
				if (!application.listing.teamId || !application.listing.organizationId) {
					throw new Error("Team recruitment listings require a team and organisation.");
				}

				await ensureOrganizationMembership(tx, {
					organizationId: application.listing.organizationId,
					userId: application.applicantUserId,
					role: "member",
					memberType: "player",
					gameRole: preferredGameRole,
				});
				await ensureTeamMembership(tx, {
					teamId: application.listing.teamId,
					userId: application.applicantUserId,
					memberType: "player",
					gameRole: preferredGameRole,
					status: "trial",
				});
				break;
			}
			case "lft": {
				if (!application.applicantTeamId) {
					throw new Error("Team applications are required for LFT listings.");
				}

				const responderTeam = await tx.query.teamTable.findFirst({
					where: eq(teamTable.id, application.applicantTeamId),
					columns: { id: true, organizationId: true },
				});
				if (!responderTeam) throw new Error("Responder team not found.");

				await ensureOrganizationMembership(tx, {
					organizationId: responderTeam.organizationId,
					userId: application.listing.userId,
					role: "member",
					memberType: "player",
					gameRole: preferredGameRole,
				});
				await ensureTeamMembership(tx, {
					teamId: responderTeam.id,
					userId: application.listing.userId,
					memberType: "player",
					gameRole: preferredGameRole,
					status: "trial",
				});
				break;
			}
			case "lfs": {
				if (
					application.listing.ownerType === "team" &&
					application.listing.teamId &&
					application.listing.organizationId
				) {
					await ensureOrganizationMembership(tx, {
						organizationId: application.listing.organizationId,
						userId: application.applicantUserId,
						role: "member",
						memberType: "staff",
						staffRole: preferredStaffRole,
					});
					await ensureTeamMembership(tx, {
						teamId: application.listing.teamId,
						userId: application.applicantUserId,
						memberType: "staff",
						staffRole: preferredStaffRole,
						status: "trial",
					});
				} else if (
					application.listing.ownerType === "organization" &&
					application.listing.organizationId
				) {
					await ensureOrganizationMembership(tx, {
						organizationId: application.listing.organizationId,
						userId: application.applicantUserId,
						role: "member",
						memberType: "staff",
						staffRole: preferredStaffRole,
					});
				} else if (application.listing.ownerType === "player") {
					if (application.applicantTeamId) {
						const responderTeam = await tx.query.teamTable.findFirst({
							where: eq(teamTable.id, application.applicantTeamId),
							columns: { id: true, organizationId: true },
						});
						if (!responderTeam) throw new Error("Responder team not found.");

						await ensureOrganizationMembership(tx, {
							organizationId: responderTeam.organizationId,
							userId: application.listing.userId,
							role: "member",
							memberType: "staff",
							staffRole: preferredStaffRole,
						});
						await ensureTeamMembership(tx, {
							teamId: responderTeam.id,
							userId: application.listing.userId,
							memberType: "staff",
							staffRole: preferredStaffRole,
							status: "trial",
						});
					} else if (application.applicantOrganizationId) {
						await ensureOrganizationMembership(tx, {
							organizationId: application.applicantOrganizationId,
							userId: application.listing.userId,
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
			.update(recruitmentApplicationTable)
			.set({ status: "accepted" })
			.where(eq(recruitmentApplicationTable.id, application.id));

		if (application.listing.type !== "lfr") {
			await tx
				.update(recruitmentListingTable)
				.set({ status: "fulfilled" })
				.where(eq(recruitmentListingTable.id, application.listingId));

			await tx
				.update(recruitmentApplicationTable)
				.set({ status: "rejected" })
				.where(
					and(
						eq(recruitmentApplicationTable.listingId, application.listingId),
						ne(recruitmentApplicationTable.id, application.id),
						eq(recruitmentApplicationTable.status, "pending")
					)
				);
		}
	});

	await createNotification({
		userId: application.applicantUserId,
		type: "recruitment_accepted",
		title: `Your application for "${application.listing.title}" was accepted.`,
		referenceType: "recruitment_application",
		referenceId: application.id,
	});

	if (application.chatChannels[0]) {
		const conversationId = application.chatChannels[0].id;
		await sendRecruitmentSystemMessage(
			conversationId,
			`Recruitment application accepted for "${application.listing.title}".`
		);
		await db
			.update(chatChannelTable)
			.set({ isArchived: true })
			.where(eq(chatChannelTable.id, conversationId));
	}

	void publishUserRealtimeEvent({
		userId: application.applicantUserId,
		event: "recruit:application-decided",
		payload: { applicationId: application.id, status: "accepted" },
	});
	const pendingCount = await countManagedPendingApplications(application.listing.userId);
	void publishUserRealtimeEvent({
		userId: application.listing.userId,
		event: "recruit:managed-pending-count",
		payload: {
			pendingCount,
		},
	});

	return c.json({ success: true });
});

export { recruitmentApplicationsRoutes };

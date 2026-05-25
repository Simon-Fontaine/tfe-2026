import {
	CreateRecruitmentApplicationSchema,
	CreateRecruitmentListingSchema,
	UpdateRecruitmentListingSchema,
} from "@scrimflow/shared";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	chatMessageTable,
	organizationTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { createNotification } from "@/notifications";
import { publishUserRealtimeEvent } from "@/realtime/scrim-hub";
import { extractErrors } from "@/routes/auth/utils";
import { getLifecycleMutationBlockReason } from "@/utils/lifecycle";
import { getOrgPermissions } from "@/utils/org";
import {
	canManageRecruitmentListing,
	countManagedPendingApplications,
	createRecruitmentConversation,
	isPlayerRecruitingDiscoverable,
	mapRecruitmentApplication,
	mapRecruitmentListing,
} from "@/utils/recruit";
import { getTeamAccessContext } from "@/utils/team";

const recruitmentListingsRoutes = new Hono<AuthEnv>();

async function getRecruitingLifecycleBlock(input: {
	teamId?: string | null;
	organizationId?: string | null;
}) {
	if (input.teamId) {
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: { lifecycleStatus: true },
		});
		return getLifecycleMutationBlockReason("Team", team?.lifecycleStatus);
	}
	if (input.organizationId) {
		const org = await db.query.organizationTable.findFirst({
			where: eq(organizationTable.id, input.organizationId),
			columns: { lifecycleStatus: true },
		});
		return getLifecycleMutationBlockReason("Organization", org?.lifecycleStatus);
	}
	return null;
}

function assertListingShape(input: {
	category: "lft" | "lfp" | "lfr" | "lfs";
	ownerType: "player" | "team" | "organization";
	memberType: "player" | "staff";
}) {
	if (input.category === "lft" && input.ownerType !== "player") {
		return "LFT listings must be created by an individual player.";
	}
	if ((input.category === "lfp" || input.category === "lfr") && input.ownerType !== "team") {
		return "LFP and LFR listings must be created on behalf of a team.";
	}
	if (input.category === "lfs" && input.memberType !== "staff") {
		return "LFS listings must target staff roles.";
	}
	if ((input.category === "lfp" || input.category === "lfr") && input.memberType !== "player") {
		return "LFP and LFR listings must target players.";
	}
	return null;
}

async function listListings(params: {
	viewerId: string | null;
	category?: "lft" | "lfp" | "lfr" | "lfs";
	memberType?: "player" | "staff";
	ownerType?: "player" | "team" | "organization";
	teamId?: string;
	organizationId?: string;
	mine?: boolean;
}) {
	const now = new Date();
	const rows = await db.query.recruitmentListingTable.findMany({
		where: and(
			params.mine ? undefined : eq(recruitmentListingTable.status, "open"),
			params.mine
				? undefined
				: or(
						isNull(recruitmentListingTable.expiresAt),
						gte(recruitmentListingTable.expiresAt, now)
					),
			params.category ? eq(recruitmentListingTable.type, params.category) : undefined,
			params.memberType ? eq(recruitmentListingTable.memberType, params.memberType) : undefined,
			params.ownerType ? eq(recruitmentListingTable.ownerType, params.ownerType) : undefined,
			params.teamId ? eq(recruitmentListingTable.teamId, params.teamId) : undefined,
			params.organizationId
				? eq(recruitmentListingTable.organizationId, params.organizationId)
				: undefined
		),
		with: {
			user: {
				columns: { id: true, username: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: {
							profileVisibility: true,
							participationIntent: true,
							recruitingDiscoverability: true,
						},
					},
				},
			},
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
		orderBy: [desc(recruitmentListingTable.createdAt)],
		limit: 100,
	});

	if (!params.mine || !params.viewerId) {
		return rows
			.filter(isPlayerRecruitingDiscoverable)
			.map((row) => mapRecruitmentListing(row, { viewerId: params.viewerId }));
	}
	const viewerId = params.viewerId;

	const scoped = await Promise.all(
		rows.map(async (row) => {
			const canManage = await canManageRecruitmentListing(row, viewerId);
			return canManage ? mapRecruitmentListing(row, { viewerId, canManage }) : null;
		})
	);

	return scoped.filter((row): row is NonNullable<typeof row> => row !== null);
}

recruitmentListingsRoutes.get("/", async (c) => {
	const user = c.get("user");
	const viewerId = user?.id ?? null;
	const category = c.req.query("category") as "lft" | "lfp" | "lfr" | "lfs" | undefined;
	const memberType = c.req.query("memberType") as "player" | "staff" | undefined;
	const ownerType = c.req.query("ownerType") as "player" | "team" | "organization" | undefined;
	const teamId = c.req.query("teamId");
	const organizationId = c.req.query("organizationId");
	const mine = c.req.query("mine") === "true";

	return c.json({
		data: await listListings({
			viewerId,
			category,
			memberType,
			ownerType,
			teamId,
			organizationId,
			mine,
		}),
	});
});

recruitmentListingsRoutes.get("/mine", async (c) => {
	const user = c.get("user");
	return c.json({ data: await listListings({ viewerId: user.id, mine: true }) });
});

recruitmentListingsRoutes.get("/:id", async (c) => {
	const user = c.get("user");
	const listing = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, c.req.param("id")),
		with: {
			user: {
				columns: { id: true, username: true, displayName: true, avatarUrl: true },
				with: {
					profile: {
						columns: {
							profileVisibility: true,
							participationIntent: true,
							recruitingDiscoverability: true,
						},
					},
				},
			},
			organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
			team: { columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true } },
			applications: { columns: { id: true, status: true, applicantUserId: true } },
		},
	});
	if (!listing) return c.json({ error: "Listing not found." }, 404);

	const canManage = await canManageRecruitmentListing(listing, user.id);
	if (!canManage && !isPlayerRecruitingDiscoverable(listing)) {
		return c.json({ error: "Listing not found." }, 404);
	}
	return c.json({ data: mapRecruitmentListing(listing, { viewerId: user.id, canManage }) });
});

recruitmentListingsRoutes.get("/:id/applications", async (c) => {
	const user = c.get("user");
	const listingId = c.req.param("id");

	const listing = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, listingId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!listing) return c.json({ error: "Listing not found." }, 404);
	if (!(await canManageRecruitmentListing(listing, user.id))) {
		return c.json(
			{ error: "You do not have permission to view applications for this listing." },
			403
		);
	}

	const rows = await db.query.recruitmentApplicationTable.findMany({
		where: eq(recruitmentApplicationTable.listingId, listingId),
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
		orderBy: [desc(recruitmentApplicationTable.createdAt)],
	});

	return c.json({ data: rows.map((row) => mapRecruitmentApplication(row)) });
});

recruitmentListingsRoutes.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateRecruitmentListingSchema, body);
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const shapeError = assertListingShape(parsed.output);
	if (shapeError) return c.json({ error: shapeError }, 400);

	let teamId: string | null = parsed.output.teamId ?? null;
	let organizationId: string | null = parsed.output.organizationId ?? null;

	if (parsed.output.ownerType === "team") {
		if (!teamId) return c.json({ error: "Team listings require a team ID." }, 400);
		const access = await getTeamAccessContext(teamId, user.id);
		if (!access?.canManageTeam) {
			return c.json(
				{ error: "You do not have permission to create a listing on behalf of this team." },
				403
			);
		}
		organizationId = access.organizationId;
		const lifecycleBlock = await getRecruitingLifecycleBlock({ teamId });
		if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);
	}

	if (parsed.output.ownerType === "organization") {
		if (!organizationId)
			return c.json({ error: "Organisation listings require an organisation ID." }, 400);
		const permissions = await getOrgPermissions(organizationId, user.id);
		if (!permissions.canManage) {
			return c.json(
				{ error: "You do not have permission to create a listing on behalf of this organisation." },
				403
			);
		}
		const lifecycleBlock = await getRecruitingLifecycleBlock({ organizationId });
		if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);
		teamId = null;
	}

	if (parsed.output.ownerType === "player") {
		teamId = null;
		organizationId = null;
	}

	const [listing] = await db
		.insert(recruitmentListingTable)
		.values({
			type: parsed.output.category,
			ownerType: parsed.output.ownerType,
			userId: user.id,
			organizationId,
			teamId,
			title: parsed.output.title,
			memberType: parsed.output.memberType,
			staffRole: parsed.output.staffRole ?? null,
			rolesNeeded: parsed.output.gameRoles ?? [],
			minRank: parsed.output.minRank ?? null,
			maxRank: parsed.output.maxRank ?? null,
			minRating: parsed.output.minRating ?? null,
			maxRating: parsed.output.maxRating ?? null,
			description: parsed.output.description ?? null,
			region: parsed.output.region ?? null,
			expiresAt: parsed.output.expiresAt ? new Date(parsed.output.expiresAt) : null,
		})
		.returning({ id: recruitmentListingTable.id });

	return c.json({ success: true, listingId: listing.id });
});

recruitmentListingsRoutes.patch("/:id", async (c) => {
	const user = c.get("user");
	const listingId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateRecruitmentListingSchema, { ...body, listingId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const listing = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, listingId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!listing) return c.json({ error: "Listing not found." }, 404);

	if (!(await canManageRecruitmentListing(listing, user.id))) {
		return c.json({ error: "You do not have permission to edit this listing." }, 403);
	}
	const lifecycleBlock = await getRecruitingLifecycleBlock(listing);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	await db
		.update(recruitmentListingTable)
		.set({
			type: parsed.output.category,
			status: parsed.output.status ?? undefined,
			title: parsed.output.title,
			description: parsed.output.description ?? null,
			memberType: parsed.output.memberType,
			staffRole: parsed.output.staffRole ?? null,
			rolesNeeded: parsed.output.gameRoles ?? [],
			minRank: parsed.output.minRank ?? null,
			maxRank: parsed.output.maxRank ?? null,
			minRating: parsed.output.minRating ?? null,
			maxRating: parsed.output.maxRating ?? null,
			region: parsed.output.region ?? null,
			expiresAt: parsed.output.expiresAt ? new Date(parsed.output.expiresAt) : null,
		})
		.where(eq(recruitmentListingTable.id, listingId));

	return c.json({ success: true });
});

recruitmentListingsRoutes.delete("/:id", async (c) => {
	const user = c.get("user");
	const listingId = c.req.param("id");

	const listing = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, listingId),
		columns: {
			id: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
	});
	if (!listing) return c.json({ error: "Listing not found." }, 404);
	if (!(await canManageRecruitmentListing(listing, user.id))) {
		return c.json({ error: "You do not have permission to delete this listing." }, 403);
	}
	// P23: block deletes on archived/deletion_pending/irreversible entities so listings
	// that belong to a non-active org or team cannot be removed mid-lifecycle.
	const lifecycleBlock = await getRecruitingLifecycleBlock(listing);
	if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);

	await db.delete(recruitmentListingTable).where(eq(recruitmentListingTable.id, listingId));
	return c.json({ success: true });
});

recruitmentListingsRoutes.post("/:id/applications", async (c) => {
	const user = c.get("user");
	const listingId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(CreateRecruitmentApplicationSchema, { ...body, listingId });
	if (!parsed.success) return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);

	const listing = await db.query.recruitmentListingTable.findFirst({
		where: eq(recruitmentListingTable.id, listingId),
		columns: {
			id: true,
			type: true,
			title: true,
			status: true,
			expiresAt: true,
			userId: true,
			ownerType: true,
			teamId: true,
			organizationId: true,
		},
		with: {
			user: {
				columns: { id: true },
				with: {
					profile: {
						columns: {
							profileVisibility: true,
							participationIntent: true,
							recruitingDiscoverability: true,
						},
					},
				},
			},
		},
	});
	if (!listing) return c.json({ error: "Listing not found." }, 404);
	if (!isPlayerRecruitingDiscoverable(listing)) {
		return c.json({ error: "Listing not found." }, 404);
	}
	const listingLifecycleBlock = await getRecruitingLifecycleBlock(listing);
	if (listingLifecycleBlock) return c.json({ error: "Listing not found." }, 404);
	if (listing.status !== "open") return c.json({ error: "This listing is no longer open." }, 400);
	if (listing.expiresAt && listing.expiresAt.getTime() < Date.now()) {
		return c.json({ error: "This listing has expired." }, 400);
	}
	if (listing.userId === user.id)
		return c.json({ error: "You cannot apply to your own listing." }, 409);

	let applicantTeamId: string | null = null;
	let applicantOrganizationId: string | null = null;

	if (listing.ownerType === "player") {
		if (parsed.output.senderTeamId) {
			const access = await getTeamAccessContext(parsed.output.senderTeamId, user.id);
			if (!access?.canManageTeam) {
				return c.json(
					{ error: "You do not have permission to submit an application as that team." },
					403
				);
			}
			applicantTeamId = access.teamId;
			applicantOrganizationId = access.organizationId;
			const lifecycleBlock = await getRecruitingLifecycleBlock({ teamId: access.teamId });
			if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);
		} else if (parsed.output.senderOrganizationId) {
			const permissions = await getOrgPermissions(parsed.output.senderOrganizationId, user.id);
			if (!permissions.canManage) {
				return c.json(
					{ error: "You do not have permission to submit an application as that organisation." },
					403
				);
			}
			applicantOrganizationId = parsed.output.senderOrganizationId;
			const lifecycleBlock = await getRecruitingLifecycleBlock({
				organizationId: parsed.output.senderOrganizationId,
			});
			if (lifecycleBlock) return c.json({ error: lifecycleBlock }, 409);
		}
	} else {
		if (parsed.output.senderTeamId || parsed.output.senderOrganizationId) {
			return c.json(
				{ error: "Applications to team and organization listings are sent as a player account." },
				400
			);
		}
	}

	const existing = await db.query.recruitmentApplicationTable.findFirst({
		where: and(
			eq(recruitmentApplicationTable.listingId, listingId),
			eq(recruitmentApplicationTable.applicantUserId, user.id),
			eq(recruitmentApplicationTable.status, "pending")
		),
		columns: { id: true },
	});
	if (existing)
		return c.json({ error: "You already have a pending application for this listing." }, 409);

	const [application] = await db
		.insert(recruitmentApplicationTable)
		.values({
			listingId,
			applicantUserId: user.id,
			applicantTeamId,
			applicantOrganizationId,
			message: parsed.output.message ?? null,
		})
		.returning({ id: recruitmentApplicationTable.id });

	const conversationId = await createRecruitmentConversation({
		applicationId: application.id,
		listingOwnerUserId: listing.userId,
		senderUserId: user.id,
		listingTitle: listing.title,
	});

	if (parsed.output.message) {
		await db.insert(chatMessageTable).values({
			channelId: conversationId,
			senderId: user.id,
			content: parsed.output.message,
		});
	}

	await createNotification({
		userId: listing.userId,
		type: "recruitment_application",
		title: `New application on "${listing.title}"`,
		body: parsed.output.message ?? undefined,
		referenceType: "recruitment_listing",
		referenceId: listingId,
	});

	const fullApplication = await db.query.recruitmentApplicationTable.findFirst({
		where: eq(recruitmentApplicationTable.id, application.id),
		columns: {
			id: true,
			listingId: true,
			message: true,
			status: true,
			createdAt: true,
			updatedAt: true,
			applicantUserId: true,
			applicantTeamId: true,
			applicantOrganizationId: true,
		},
		with: {
			applicant: {
				columns: { id: true, username: true, displayName: true, avatarUrl: true },
				with: { profile: { columns: { primaryRole: true, rank: true } } },
			},
			applicantTeam: { columns: { id: true, name: true, tag: true } },
			applicantOrganization: { columns: { id: true, name: true, slug: true } },
		},
	});

	if (fullApplication) {
		const pendingCount = await countManagedPendingApplications(listing.userId);

		void publishUserRealtimeEvent({
			userId: listing.userId,
			event: "recruit:application-received",
			payload: {
				listingId,
				application: mapRecruitmentApplication({
					...fullApplication,
					chatChannels: [{ id: conversationId }],
				}),
			},
		});
		void publishUserRealtimeEvent({
			userId: listing.userId,
			event: "recruit:managed-pending-count",
			payload: {
				pendingCount,
			},
		});
	}

	return c.json({ success: true, applicationId: application.id, conversationId });
});

export { recruitmentListingsRoutes };

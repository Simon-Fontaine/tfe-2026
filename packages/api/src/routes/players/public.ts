import type { PublicPlayerDetail, PublicPlayerSummary } from "@scrimflow/shared";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { recruitmentListingTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { mapRecruitmentListing } from "@/utils/recruit";

const publicPlayerRoutes = new Hono<AuthEnv>();

publicPlayerRoutes.use("*", optionalAuth);

publicPlayerRoutes.get("/", async (c) => {
	const viewer = c.get("user");
	const rows = await db.query.userTable.findMany({
		columns: {
			id: true,
			username: true,
			displayName: true,
			avatarUrl: true,
			bio: true,
		},
		with: {
			profile: {
				columns: {
					primaryRole: true,
					secondaryRole: true,
					rank: true,
					rankDivision: true,
				},
			},
			recruitmentListings: {
				where: eq(recruitmentListingTable.status, "open"),
				with: {
					user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
					organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
					team: { columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true } },
					applications: { columns: { id: true, status: true, applicantUserId: true } },
				},
			},
		},
		orderBy: [asc(userTable.displayName)],
		limit: 100,
	});

	const data: PublicPlayerSummary[] = rows.map((row) => ({
		id: row.id,
		username: row.username,
		displayName: row.displayName,
		avatarUrl: row.avatarUrl,
		bio: row.bio ?? null,
		primaryRole: row.profile?.primaryRole ?? null,
		secondaryRole: row.profile?.secondaryRole ?? null,
		rank: row.profile?.rank ?? null,
		rankDivision: row.profile?.rankDivision ?? null,
		openListings: row.recruitmentListings
			.filter((post) => post.ownerType === "player")
			.map((post) => mapRecruitmentListing(post, { viewerId: viewer?.id ?? null })),
	}));

	return c.json({ data });
});

publicPlayerRoutes.get("/:username", async (c) => {
	const viewer = c.get("user");
	const username = c.req.param("username");

	const player = await db.query.userTable.findFirst({
		where: eq(userTable.username, username),
		columns: {
			id: true,
			username: true,
			displayName: true,
			avatarUrl: true,
			bannerUrl: true,
			bio: true,
		},
		with: {
			profile: {
				columns: {
					primaryRole: true,
					secondaryRole: true,
					rank: true,
					rankDivision: true,
				},
			},
			recruitmentListings: {
				where: eq(recruitmentListingTable.status, "open"),
				with: {
					user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
					organization: { columns: { id: true, name: true, slug: true, avatarUrl: true } },
					team: { columns: { id: true, name: true, tag: true, avatarUrl: true, rating: true } },
					applications: { columns: { id: true, status: true, applicantUserId: true } },
				},
			},
		},
	});
	if (!player) return c.json({ error: "Player not found." }, 404);

	const openListings = player.recruitmentListings
		.filter((post) => post.ownerType === "player")
		.map((post) => mapRecruitmentListing(post, { viewerId: viewer?.id ?? null }));

	const data: PublicPlayerDetail = {
		id: player.id,
		username: player.username,
		displayName: player.displayName,
		avatarUrl: player.avatarUrl,
		bannerUrl: player.bannerUrl ?? null,
		bio: player.bio ?? null,
		primaryRole: player.profile?.primaryRole ?? null,
		secondaryRole: player.profile?.secondaryRole ?? null,
		rank: player.profile?.rank ?? null,
		rankDivision: player.profile?.rankDivision ?? null,
		openListings,
	};

	return c.json({ data });
});

export { publicPlayerRoutes };

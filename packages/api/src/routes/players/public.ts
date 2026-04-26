import type { PublicPlayerDetail, PublicPlayerSummary } from "@scrimflow/shared";
import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { recruitmentListingTable, scrimTable, teamRosterTable, userTable } from "@/db/schema";
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
					profileVisibility: true,
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

	const data: PublicPlayerSummary[] = rows
		.filter((row) => (row.profile?.profileVisibility ?? "public") === "public")
		.map((row) => ({
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
					battletag: true,
					primaryRole: true,
					secondaryRole: true,
					rank: true,
					rankDivision: true,
					profileVisibility: true,
				},
			},
			heroPool: {
				with: {
					hero: {
						columns: {
							id: true,
							displayName: true,
							role: true,
							imageUrl: true,
						},
					},
				},
			},
			teamRosters: {
				where: eq(teamRosterTable.status, "active"),
				with: {
					team: {
						columns: { id: true, name: true, tag: true, organizationId: true },
						with: {
							organization: {
								columns: { name: true, slug: true },
							},
						},
					},
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

	const visibility = player.profile?.profileVisibility ?? "public";
	if (visibility === "private") {
		return c.json({ error: "Player not found." }, 404);
	}
	if (visibility === "teams_only") {
		const viewerUser = c.get("user");
		if (!viewerUser) return c.json({ error: "Player not found." }, 404);
	}

	const openListings = player.recruitmentListings
		.filter((post) => post.ownerType === "player")
		.map((post) => mapRecruitmentListing(post, { viewerId: viewer?.id ?? null }));

	// Derive team IDs this player is on
	const playerTeamIds = player.teamRosters.map((r) => r.team.id);

	// Derive scrim stats if player belongs to any teams
	let scrimStats: PublicPlayerDetail["scrimStats"] = null;
	if (playerTeamIds.length > 0) {
		const completedScrims = await db.query.scrimTable.findMany({
			where: and(
				eq(scrimTable.status, "completed"),
				or(
					...playerTeamIds.flatMap((id) => [
						eq(scrimTable.homeTeamId, id),
						eq(scrimTable.awayTeamId, id),
					])
				)
			),
			columns: {
				id: true,
				homeTeamId: true,
				awayTeamId: true,
				homeMapScore: true,
				awayMapScore: true,
			},
		});

		let wins = 0;
		let losses = 0;
		let draws = 0;
		for (const scrim of completedScrims) {
			const isHome = playerTeamIds.includes(scrim.homeTeamId);
			const h = scrim.homeMapScore;
			const a = scrim.awayMapScore;
			if (h === a) draws++;
			else if ((isHome && h > a) || (!isHome && a > h)) wins++;
			else losses++;
		}
		scrimStats = { scrimsPlayed: completedScrims.length, wins, losses, draws };
	}

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
		battletag: player.profile?.battletag ?? null,
		heroPool: player.heroPool.map((ph) => ({
			heroId: ph.hero.id,
			displayName: ph.hero.displayName,
			role: ph.hero.role,
			imageUrl: ph.hero.imageUrl ?? null,
		})),
		teams: player.teamRosters.map((r) => ({
			id: r.team.id,
			name: r.team.name,
			tag: r.team.tag,
			organizationName: r.team.organization?.name ?? "",
			organizationSlug: r.team.organization?.slug ?? "",
		})),
		scrimStats,
	};

	return c.json({ data });
});

export { publicPlayerRoutes };

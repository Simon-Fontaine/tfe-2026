import type {
	AvailabilityIntent,
	PublicPlayerDetail,
	PublicPlayerSummary,
	TeamViewableStatus,
} from "@scrimflow/shared";
import { and, asc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { recruitmentListingTable, scrimTable, teamRosterTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { mapRecruitmentListing } from "@/utils/recruit";

const publicPlayerRoutes = new Hono<AuthEnv>();

publicPlayerRoutes.use("*", optionalAuth);

const isActivelyRecruiting = (profile?: {
	profileVisibility?: string | null;
	participationIntent?: string | null;
	recruitingDiscoverability?: boolean | null;
}) =>
	(profile?.profileVisibility ?? "public") === "public" &&
	profile?.recruitingDiscoverability !== false &&
	profile?.participationIntent === "find_team";

const isPublic = (value?: string | null) => (value ?? "public") === "public";

const CONFIRMED_TEAM_HISTORY_STATUSES = ["active", "benched", "inactive"] as const;
const CURRENT_CONFIRMED_TEAM_STATUSES = ["active", "benched"] as const;

publicPlayerRoutes.get("/", async (c) => {
	const viewer = c.get("user");
	const now = new Date();
	const viewerCurrentTeamIds = viewer
		? await db.query.teamRosterTable
				.findMany({
					where: and(
						eq(teamRosterTable.userId, viewer.id),
						inArray(teamRosterTable.status, CURRENT_CONFIRMED_TEAM_STATUSES)
					),
					columns: { teamId: true },
				})
				.then((memberships) => new Set(memberships.map((membership) => membership.teamId)))
		: new Set<string>();
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
					availabilityVisibility: true,
					recruitingDiscoverability: true,
					publicHistoryVisibility: true,
					participationIntent: true,
					availabilityIntent: true,
				},
			},
			teamRosters: {
				where: inArray(teamRosterTable.status, CURRENT_CONFIRMED_TEAM_STATUSES),
				columns: { teamId: true },
			},
			recruitmentListings: {
				where: and(
					eq(recruitmentListingTable.status, "open"),
					or(isNull(recruitmentListingTable.expiresAt), gte(recruitmentListingTable.expiresAt, now))
				),
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
		.map((row) => {
			const canViewTeamsOnlyFields =
				viewer?.id === row.id ||
				row.teamRosters.some((membership) => viewerCurrentTeamIds.has(membership.teamId));
			const canShowAvailability =
				isPublic(row.profile?.availabilityVisibility) ||
				((row.profile?.availabilityVisibility ?? "public") === "teams_only" &&
					canViewTeamsOnlyFields);

			return {
				id: row.id,
				username: row.username,
				displayName: row.displayName,
				avatarUrl: row.avatarUrl,
				bio: row.bio ?? null,
				primaryRole: row.profile?.primaryRole ?? null,
				secondaryRole: row.profile?.secondaryRole ?? null,
				rank: row.profile?.rank ?? null,
				rankDivision: row.profile?.rankDivision ?? null,
				profileVisibility: "public",
				availabilityIntent: canShowAvailability
					? ((row.profile?.availabilityIntent ?? null) as AvailabilityIntent | null)
					: null,
				recruitingStatus: isActivelyRecruiting(row.profile) ? "looking" : "unavailable",
				openListings: row.recruitmentListings
					.filter((post) => post.ownerType === "player" && isActivelyRecruiting(row.profile))
					.map((post) => mapRecruitmentListing(post, { viewerId: viewer?.id ?? null })),
			};
		});

	return c.json({ data });
});

publicPlayerRoutes.get("/:username", async (c) => {
	const viewer = c.get("user");
	const username = c.req.param("username");
	const now = new Date();

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
					availabilityVisibility: true,
					recruitingDiscoverability: true,
					publicHistoryVisibility: true,
					participationIntent: true,
					availabilityIntent: true,
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
				where: inArray(teamRosterTable.status, CONFIRMED_TEAM_HISTORY_STATUSES),
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
				where: and(
					eq(recruitmentListingTable.status, "open"),
					or(isNull(recruitmentListingTable.expiresAt), gte(recruitmentListingTable.expiresAt, now))
				),
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

	const currentTeamIds = player.teamRosters
		.filter((row) => row.status === "active" || row.status === "benched")
		.map((row) => row.team.id);
	let canViewTeamsOnlyFields = false;
	const viewerUser = c.get("user");
	if (viewerUser) {
		if (viewerUser.id === player.id) {
			canViewTeamsOnlyFields = true;
		} else if (currentTeamIds.length > 0) {
			const sharedMembership = await db.query.teamRosterTable.findFirst({
				where: and(
					eq(teamRosterTable.userId, viewerUser.id),
					inArray(teamRosterTable.teamId, currentTeamIds),
					inArray(teamRosterTable.status, CURRENT_CONFIRMED_TEAM_STATUSES)
				),
				columns: { id: true },
			});
			canViewTeamsOnlyFields = Boolean(sharedMembership);
		}
	}

	if (visibility === "teams_only") {
		if (!viewerUser) return c.json({ error: "Player not found." }, 404);
		if (!canViewTeamsOnlyFields) return c.json({ error: "Player not found." }, 404);
	}

	const openListings = player.recruitmentListings
		.filter((post) => post.ownerType === "player" && isActivelyRecruiting(player.profile))
		.map((post) => mapRecruitmentListing(post, { viewerId: viewer?.id ?? null }));

	const canViewField = (value?: string | null) =>
		isPublic(value) || ((value ?? "public") === "teams_only" && canViewTeamsOnlyFields);
	const canShowAvailability = canViewField(player.profile?.availabilityVisibility);
	const canShowPublicHistory = canViewField(player.profile?.publicHistoryVisibility);
	const playerTeamIds = canShowPublicHistory ? player.teamRosters.map((r) => r.team.id) : [];

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
		profileVisibility: "public",
		availabilityIntent: canShowAvailability
			? ((player.profile?.availabilityIntent ?? null) as AvailabilityIntent | null)
			: null,
		recruitingStatus: isActivelyRecruiting(player.profile) ? "looking" : "unavailable",
		openListings,
		battletag: player.profile?.battletag ?? null,
		heroPool: player.heroPool.map((ph) => ({
			heroId: ph.hero.id,
			displayName: ph.hero.displayName,
			role: ph.hero.role,
			imageUrl: ph.hero.imageUrl ?? null,
		})),
		teams: canShowPublicHistory
			? player.teamRosters.map((r) => ({
					id: r.team.id,
					name: r.team.name,
					tag: r.team.tag,
					organizationName: r.team.organization?.name ?? "",
					organizationSlug: r.team.organization?.slug ?? "",
					status: r.status as TeamViewableStatus,
					joinedAt: r.joinedAt.toISOString(),
					leftAt: r.leftAt?.toISOString() ?? null,
				}))
			: [],
		scrimStats,
	};

	return c.json({ data });
});

export { publicPlayerRoutes };

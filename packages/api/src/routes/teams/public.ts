import type {
	DiscoveryTeam,
	PublicRosterMemberSummary,
	TeamPublicPreview,
} from "@scrimflow/shared";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import {
	organizationTable,
	recruitmentListingTable,
	scrimTable,
	teamRosterTable,
	teamTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { optionalAuth } from "@/middleware/auth";
import { mapRecruitmentListing } from "@/utils/recruit";

const publicTeamRoutes = new Hono<AuthEnv>();

publicTeamRoutes.use("*", optionalAuth);

publicTeamRoutes.get("/", async (c) => {
	const recruiting = c.req.query("recruiting");
	const recruitingFilter =
		recruiting === "true" ? true : recruiting === "false" ? false : undefined;

	// P33: Filter on org lifecycle/visibility at SQL level so the limit:60 window
	// is not silently consumed by teams whose parent org is archived or private.
	const activePublicOrgIds = (
		await db
			.select({ id: organizationTable.id })
			.from(organizationTable)
			.where(
				and(eq(organizationTable.isPublic, true), eq(organizationTable.lifecycleStatus, "active"))
			)
	).map((o) => o.id);

	if (activePublicOrgIds.length === 0) return c.json({ data: [] });

	const rows = await db.query.teamTable.findMany({
		where: and(
			eq(teamTable.isArchived, false),
			eq(teamTable.isPublic, true),
			eq(teamTable.lifecycleStatus, "active"),
			inArray(teamTable.organizationId, activePublicOrgIds),
			recruitingFilter !== undefined ? eq(teamTable.isRecruiting, recruitingFilter) : undefined
		),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			rating: true,
			isRecruiting: true,
		},
		with: {
			roster: {
				columns: { id: true, status: true },
			},
			recruitmentListings: {
				where: eq(recruitmentListingTable.status, "open"),
				columns: { id: true },
			},
		},
		orderBy: [asc(teamTable.name)],
		limit: 60,
	});

	const data: DiscoveryTeam[] = rows.map((team) => ({
		id: team.id,
		organizationId: team.organizationId,
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		rating: team.rating,
		isRecruiting: team.isRecruiting,
		activeRosterCount: team.roster.filter((row) => row.status !== "inactive").length,
		openListingCount: team.recruitmentListings.length,
	}));

	return c.json({ data });
});

publicTeamRoutes.get("/:id", async (c) => {
	const teamId = c.req.param("id");
	const user = c.get("user");

	const team = await db.query.teamTable.findFirst({
		where: and(
			eq(teamTable.id, teamId),
			eq(teamTable.isArchived, false),
			eq(teamTable.isPublic, true),
			eq(teamTable.lifecycleStatus, "active")
		),
		columns: {
			id: true,
			organizationId: true,
			name: true,
			tag: true,
			description: true,
			avatarUrl: true,
			bannerUrl: true,
			rating: true,
			matchesPlayed: true,
			isRecruiting: true,
			isArchived: true,
		},
		with: {
			organization: {
				columns: {
					name: true,
					slug: true,
					isPublic: true,
					lifecycleStatus: true,
				},
			},
			roster: {
				where: ne(teamRosterTable.status, "inactive"),
				columns: {
					id: true,
					userId: true,
					memberType: true,
					staffRole: true,
					roleInTeam: true,
					status: true,
				},
				with: {
					user: {
						columns: { id: true, username: true, displayName: true, avatarUrl: true },
						with: {
							profile: { columns: { rank: true } },
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
			homeScrims: {
				where: eq(scrimTable.status, "completed"),
				columns: {
					id: true,
					homeTeamId: true,
					awayTeamId: true,
					homeMapScore: true,
					awayMapScore: true,
					scheduledAt: true,
				},
				with: {
					awayTeam: { columns: { name: true, tag: true, isArchived: true } },
				},
				orderBy: (s, { desc: d }) => [d(s.scheduledAt)],
				limit: 10,
			},
			awayScrims: {
				where: eq(scrimTable.status, "completed"),
				columns: {
					id: true,
					homeTeamId: true,
					awayTeamId: true,
					homeMapScore: true,
					awayMapScore: true,
					scheduledAt: true,
				},
				with: {
					homeTeam: { columns: { name: true, tag: true, isArchived: true } },
				},
				orderBy: (s, { desc: d }) => [d(s.scheduledAt)],
				limit: 10,
			},
		},
	});

	if (!team || !team.organization?.isPublic || team.organization.lifecycleStatus !== "active") {
		return c.json({ error: "Team not found." }, 404);
	}

	// Derive win/loss/draw and recentScrims from completed scrim results
	let wins = 0;
	let losses = 0;
	let draws = 0;

	type RecentScrim = TeamPublicPreview["recentScrims"][number];
	const allScrims: RecentScrim[] = [];

	for (const scrim of team.homeScrims ?? []) {
		const h = scrim.homeMapScore;
		const a = scrim.awayMapScore;
		if (h === a) draws++;
		else if (h > a) wins++;
		else losses++;
		allScrims.push({
			id: scrim.id,
			opponentName: scrim.awayTeam?.name ?? "TBD",
			opponentTag: scrim.awayTeam?.tag ?? "???",
			opponentIsArchived: scrim.awayTeam?.isArchived ?? false,
			result: h === a ? "draw" : h > a ? "win" : "loss",
			homeMapScore: h,
			awayMapScore: a,
			scheduledAt: scrim.scheduledAt ? scrim.scheduledAt.toISOString() : null,
		});
	}

	for (const scrim of team.awayScrims ?? []) {
		const h = scrim.homeMapScore;
		const a = scrim.awayMapScore;
		if (h === a) draws++;
		else if (a > h) wins++;
		else losses++;
		allScrims.push({
			id: scrim.id,
			opponentName: scrim.homeTeam?.name ?? "TBD",
			opponentTag: scrim.homeTeam?.tag ?? "???",
			opponentIsArchived: scrim.homeTeam?.isArchived ?? false,
			result: h === a ? "draw" : a > h ? "win" : "loss",
			homeMapScore: h,
			awayMapScore: a,
			scheduledAt: scrim.scheduledAt ? scrim.scheduledAt.toISOString() : null,
		});
	}

	const recentScrims = allScrims
		.sort((a, b) => {
			if (!a.scheduledAt && !b.scheduledAt) return 0;
			if (!a.scheduledAt) return 1;
			if (!b.scheduledAt) return -1;
			return b.scheduledAt.localeCompare(a.scheduledAt);
		})
		.slice(0, 10);

	// Derive role breakdown from active roster
	const roleBreakdown = { tank: 0, damage: 0, support: 0 };
	for (const member of team.roster) {
		if (member.roleInTeam === "tank") roleBreakdown.tank++;
		else if (member.roleInTeam === "damage") roleBreakdown.damage++;
		else if (member.roleInTeam === "support") roleBreakdown.support++;
	}

	const data: TeamPublicPreview = {
		id: team.id,
		organizationId: team.organizationId,
		organizationName: team.organization?.name ?? "Organisation",
		organizationSlug: team.organization?.slug ?? "",
		name: team.name,
		tag: team.tag,
		description: team.description ?? null,
		avatarUrl: team.avatarUrl,
		bannerUrl: team.bannerUrl ?? null,
		rating: team.rating,
		matchesPlayed: team.matchesPlayed,
		isRecruiting: team.isRecruiting,
		isArchived: team.isArchived,
		activeRosterCount: team.roster.length,
		openListingCount: team.recruitmentListings.length,
		hasOpenListing: team.recruitmentListings.length > 0,
		roster: team.roster.map(
			(row): PublicRosterMemberSummary => ({
				userId: row.user.id,
				username: row.user.username,
				displayName: row.user.displayName,
				avatarUrl: row.user.avatarUrl,
				memberType: row.memberType,
				staffRole: row.staffRole ?? null,
				roleInTeam: row.roleInTeam ?? null,
				rank: row.user.profile?.rank ?? null,
				status: row.status,
			})
		),
		listings: team.recruitmentListings.map((listing) =>
			mapRecruitmentListing(listing, { viewerId: user?.id ?? null })
		),
		wins,
		losses,
		draws,
		roleBreakdown,
		recentScrims,
	};

	return c.json({ data });
});

export { publicTeamRoutes };

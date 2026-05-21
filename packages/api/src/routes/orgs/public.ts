import type { PublicOrgDetail, PublicOrgSummary } from "@scrimflow/shared";
import { and, asc, eq, or } from "drizzle-orm";
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

const publicOrgRoutes = new Hono<AuthEnv>();

publicOrgRoutes.use("*", optionalAuth);

publicOrgRoutes.get("/", async (c) => {
	const rows = await db.query.organizationTable.findMany({
		where: eq(organizationTable.isPublic, true),
		columns: {
			id: true,
			slug: true,
			name: true,
			avatarUrl: true,
			description: true,
		},
		with: {
			teams: {
				where: and(eq(teamTable.isArchived, false), eq(teamTable.isPublic, true)),
				columns: { id: true },
				with: {
					roster: {
						where: eq(teamRosterTable.status, "active"),
						columns: { id: true },
					},
				},
			},
			recruitmentListings: {
				where: eq(recruitmentListingTable.status, "open"),
				columns: { id: true },
			},
		},
		orderBy: [asc(organizationTable.name)],
		limit: 100,
	});

	const data: PublicOrgSummary[] = rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		name: row.name,
		avatarUrl: row.avatarUrl,
		description: row.description ?? null,
		teamCount: row.teams.length,
		activeRosterCount: row.teams.reduce((sum, team) => sum + team.roster.length, 0),
		openListingCount: row.recruitmentListings.length,
	}));

	return c.json({ data });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

publicOrgRoutes.get("/:id", async (c) => {
	const idOrSlug = c.req.param("id");
	const user = c.get("user");

	const whereCondition = UUID_RE.test(idOrSlug)
		? and(
				eq(organizationTable.isPublic, true),
				or(eq(organizationTable.id, idOrSlug), eq(organizationTable.slug, idOrSlug))
			)
		: and(eq(organizationTable.isPublic, true), eq(organizationTable.slug, idOrSlug));

	const org = await db.query.organizationTable.findFirst({
		where: whereCondition,
		columns: {
			id: true,
			slug: true,
			name: true,
			avatarUrl: true,
			bannerUrl: true,
			description: true,
			website: true,
			discord: true,
			twitter: true,
		},
		with: {
			teams: {
				where: and(eq(teamTable.isArchived, false), eq(teamTable.isPublic, true)),
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
					isPublic: true,
				},
				with: {
					roster: {
						columns: { id: true, userId: true, permissionRole: true, status: true },
					},
					homeScrims: {
						where: eq(scrimTable.status, "completed"),
						columns: { id: true },
					},
					awayScrims: {
						where: eq(scrimTable.status, "completed"),
						columns: { id: true },
					},
				},
				orderBy: [asc(teamTable.name)],
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

	if (!org) return c.json({ error: "Organisation not found." }, 404);

	const data: PublicOrgDetail = {
		id: org.id,
		slug: org.slug,
		name: org.name,
		avatarUrl: org.avatarUrl,
		bannerUrl: org.bannerUrl ?? null,
		description: org.description ?? null,
		teamCount: org.teams.length,
		activeRosterCount: org.teams.reduce(
			(sum, team) => sum + team.roster.filter((row) => row.status !== "inactive").length,
			0
		),
		teams: org.teams.map((team) => ({
			id: team.id,
			organizationId: org.id,
			organizationName: org.name,
			organizationSlug: org.slug,
			name: team.name,
			tag: team.tag,
			description: team.description ?? null,
			avatarUrl: team.avatarUrl,
			bannerUrl: team.bannerUrl ?? null,
			rating: team.rating,
			matchesPlayed: team.matchesPlayed,
			isRecruiting: team.isRecruiting,
			isArchived: team.isArchived,
			isPublic: team.isPublic,
			activeRosterCount: team.roster.filter((row) => row.status !== "inactive").length,
			adminCount: new Set(
				team.roster
					.filter((row) => row.status !== "inactive" && row.permissionRole === "admin")
					.map((row) => row.userId)
			).size,
		})),
		openListings: org.recruitmentListings.map((listing) =>
			mapRecruitmentListing(listing, { viewerId: user?.id ?? null })
		),
		totalScrims: new Set(
			org.teams.flatMap((team) => [
				...(team.homeScrims ?? []).map((s) => s.id),
				...(team.awayScrims ?? []).map((s) => s.id),
			])
		).size,
		website: org.website ?? null,
		discord: org.discord ?? null,
		twitter: org.twitter ?? null,
	};

	return c.json({ data });
});

export { publicOrgRoutes };

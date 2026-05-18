import { UpdateBasicInfoSchema, UpdateGameProfileSchema } from "@scrimflow/shared";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import {
	heroTable,
	playerHeroTable,
	playerProfileTable,
	scrimTable,
	teamRosterTable,
	userTable,
} from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const profileRoutes = new Hono<AuthEnv>();

// GET /exists — Check if player profile exists (for layout guards)
profileRoutes.get("/exists", async (c) => {
	const user = c.get("user");
	const profile = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	return c.json({ data: { exists: !!profile } });
});

// GET /user-info — Get user display info (for profile page editing)
profileRoutes.get("/user-info", async (c) => {
	const user = c.get("user");
	const row = await db.query.userTable.findFirst({
		where: eq(userTable.id, user.id),
		columns: {
			displayName: true,
			bio: true,
			socialLinks: true,
			avatarUrl: true,
			bannerUrl: true,
		},
	});
	return c.json({ data: row ?? null });
});

// GET / — Get current user's full profile
profileRoutes.get("/", async (c) => {
	const user = c.get("user");

	const profile = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: {
			battletag: true,
			primaryRole: true,
			secondaryRole: true,
			rank: true,
			rankDivision: true,
			participationIntent: true,
			availabilityIntent: true,
		},
	});

	if (!profile) return c.json({ data: null });

	const heroRows = await db.query.playerHeroTable.findMany({
		where: eq(playerHeroTable.userId, user.id),
		with: {
			hero: {
				columns: { id: true, displayName: true, role: true, imageUrl: true },
			},
		},
		orderBy: [asc(playerHeroTable.heroId)],
	});

	return c.json({
		data: {
			battletag: profile.battletag,
			primaryRole: profile.primaryRole,
			secondaryRole: profile.secondaryRole ?? null,
			rank: profile.rank ?? null,
			rankDivision: profile.rankDivision ?? null,
			participationIntent: profile.participationIntent,
			availabilityIntent: profile.availabilityIntent,
			heroes: heroRows.map((row) => row.hero),
		},
	});
});

// GET /stats — Get player stats summary
profileRoutes.get("/stats", async (c) => {
	const user = c.get("user");

	const memberships = await db.query.teamRosterTable.findMany({
		where: and(eq(teamRosterTable.userId, user.id), eq(teamRosterTable.status, "active")),
		columns: { teamId: true },
		with: {
			team: {
				columns: { rating: true },
			},
		},
	});

	const teamIds = [...new Set(memberships.map((membership) => membership.teamId))];
	const topTeamRating =
		memberships.length > 0
			? Math.max(...memberships.map((membership) => membership.team?.rating ?? 0))
			: null;
	let scrimsPlayed = 0;
	let wins = 0;

	if (teamIds.length > 0) {
		const scrims = await db.query.scrimTable.findMany({
			where: and(
				eq(scrimTable.status, "completed"),
				or(inArray(scrimTable.homeTeamId, teamIds), inArray(scrimTable.awayTeamId, teamIds))
			),
			columns: {
				homeTeamId: true,
				awayTeamId: true,
				homeMapScore: true,
				awayMapScore: true,
			},
		});

		scrimsPlayed = scrims.length;
		wins = scrims.filter((scrim) =>
			teamIds.some((teamId) => {
				if (scrim.homeTeamId === teamId) {
					return scrim.homeMapScore > scrim.awayMapScore;
				}
				if (scrim.awayTeamId === teamId) {
					return scrim.awayMapScore > scrim.homeMapScore;
				}
				return false;
			})
		).length;
	}

	return c.json({
		data: {
			topTeamRating,
			scrimsPlayed,
			wins,
		},
	});
});

// PATCH / basic — Update display name, bio, social links
profileRoutes.patch("/basic", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateBasicInfoSchema, body);
	if (!parsed.success) {
		return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	}

	const { displayName, bio, socialLinks } = parsed.output;

	const filteredLinks: Record<string, string> = {};
	if (socialLinks?.twitter) filteredLinks.twitter = socialLinks.twitter;
	if (socialLinks?.discord) filteredLinks.discord = socialLinks.discord;
	if (socialLinks?.twitch) filteredLinks.twitch = socialLinks.twitch;
	if (socialLinks?.youtube) filteredLinks.youtube = socialLinks.youtube;

	await db
		.update(userTable)
		.set({
			displayName,
			bio: bio ?? null,
			socialLinks: filteredLinks,
		})
		.where(eq(userTable.id, user.id));

	return c.json({ success: true });
});

// PATCH /game — Update game profile (battletag, role, rank, hero pool)
profileRoutes.patch("/game", async (c) => {
	const user = c.get("user");

	const body = await c.req.json().catch(() => null);
	if (!body) return c.json({ error: "Invalid request body." }, 400);

	const parsed = v.safeParse(UpdateGameProfileSchema, body);
	if (!parsed.success) {
		return c.json({ fieldErrors: extractErrors(parsed.issues) }, 400);
	}

	const existing = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (!existing) {
		return c.json({ error: "Player profile not found. Please complete onboarding first." }, 404);
	}

	const {
		battletag,
		primaryRole,
		secondaryRole,
		rank,
		rankDivision,
		heroPool: heroes,
	} = parsed.output;

	// Validate hero IDs against the active hero registry
	const activeHeroes = await db.query.heroTable.findMany({
		where: eq(heroTable.isActive, true),
		columns: { id: true },
	});
	const validIds = new Set(activeHeroes.map((h) => h.id));
	const invalidHeroes = heroes.filter((id) => !validIds.has(id));
	if (invalidHeroes.length > 0) {
		return c.json({ error: "Your hero pool contains unrecognised heroes. Please try again." }, 400);
	}

	const effectiveDivision = !rank ? null : (rankDivision ?? null);

	await db.transaction(async (tx) => {
		await tx
			.update(playerProfileTable)
			.set({
				battletag: battletag ?? null,
				primaryRole,
				secondaryRole: secondaryRole ?? null,
				rank: rank ?? null,
				rankDivision: effectiveDivision,
			})
			.where(eq(playerProfileTable.userId, user.id));

		await tx.delete(playerHeroTable).where(eq(playerHeroTable.userId, user.id));

		if (heroes.length > 0) {
			await tx
				.insert(playerHeroTable)
				.values(heroes.map((heroId) => ({ userId: user.id, heroId })));
		}
	});

	return c.json({ success: true });
});

export { profileRoutes };

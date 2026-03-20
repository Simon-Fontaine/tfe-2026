import { UpdateBasicInfoSchema, UpdateGameProfileSchema } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { db } from "@/db";
import { heroTable, playerHeroTable, playerProfileTable, userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import { extractErrors } from "@/routes/auth/utils";

const profileRoutes = new Hono<AuthEnv>();

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

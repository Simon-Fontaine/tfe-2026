"use server";

import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { heroTable, playerHeroTable, playerProfileTable } from "@/db/schema";
import type { OnboardingActionResult } from "@/hooks/use-onboarding-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { CreatePlayerProfileSchema } from "@/lib/validations/onboarding";

export async function createPlayerProfileAction(
	_prev: OnboardingActionResult | null,
	formData: FormData
): Promise<OnboardingActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return { error: "You must be signed in to complete setup." };
	}

	// Idempotency: if a profile already exists just navigate away
	const existing = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (existing) return { redirect: "/dashboard" };

	const rawDivision = formData.get("rankDivision");
	const heroPool = formData.getAll("heroPool[]") as string[];

	const parsed = v.safeParse(CreatePlayerProfileSchema, {
		battletag: formData.get("battletag") || undefined,
		primaryRole: formData.get("primaryRole"),
		secondaryRole: formData.get("secondaryRole") || null,
		rank: formData.get("rank") || null,
		rankDivision: rawDivision ? Number(rawDivision) : null,
		heroPool,
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const {
		battletag,
		primaryRole,
		secondaryRole,
		rank,
		rankDivision,
		heroPool: heroes,
	} = parsed.output;

	// Validate submitted hero IDs against the active hero registry
	const activeHeroes = await db.query.heroTable.findMany({
		where: eq(heroTable.isActive, true),
		columns: { id: true },
	});
	const validIds = new Set(activeHeroes.map((h) => h.id));
	const invalidHeroes = heroes.filter((id) => !validIds.has(id));
	if (invalidHeroes.length > 0) {
		return { error: "Your hero pool contains unrecognised heroes. Please try again." };
	}

	const effectiveDivision = !rank ? null : (rankDivision ?? null);

	await db.transaction(async (tx) => {
		await tx.insert(playerProfileTable).values({
			userId: user.id,
			battletag: battletag ?? null,
			primaryRole,
			secondaryRole: secondaryRole ?? null,
			rank: rank ?? null,
			rankDivision: effectiveDivision,
		});

		if (heroes.length > 0) {
			await tx
				.insert(playerHeroTable)
				.values(heroes.map((heroId) => ({ userId: user.id, heroId })));
		}
	});

	return { redirect: "/dashboard" };
}

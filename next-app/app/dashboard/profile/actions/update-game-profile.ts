"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import { heroTable, playerHeroTable, playerProfileTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { UpdateGameProfileSchema } from "@/lib/validations/profile";

export async function updateGameProfileAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return { error: "You must be signed in to update your profile." };
	}

	const existing = await db.query.playerProfileTable.findFirst({
		where: eq(playerProfileTable.userId, user.id),
		columns: { id: true },
	});
	if (!existing) {
		return { error: "Player profile not found. Please complete onboarding first." };
	}

	const rawDivision = formData.get("rankDivision");
	const heroPool = formData.getAll("heroPool[]") as string[];

	const parsed = v.safeParse(UpdateGameProfileSchema, {
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

		// Replace hero pool: delete existing, re-insert
		await tx.delete(playerHeroTable).where(eq(playerHeroTable.userId, user.id));

		if (heroes.length > 0) {
			await tx
				.insert(playerHeroTable)
				.values(heroes.map((heroId) => ({ userId: user.id, heroId })));
		}
	});

	revalidatePath("/dashboard");
	revalidatePath("/dashboard/profile");
	return { success: true };
}

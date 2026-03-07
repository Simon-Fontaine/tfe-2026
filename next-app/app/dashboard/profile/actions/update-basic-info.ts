"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { UpdateBasicInfoSchema } from "@/lib/validations/profile";

export async function updateBasicInfoAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return { error: "You must be signed in to update your profile." };
	}

	const parsed = v.safeParse(UpdateBasicInfoSchema, {
		displayName: formData.get("displayName"),
		bio: formData.get("bio") ?? undefined,
		socialLinks: {
			twitter: formData.get("twitter") ?? undefined,
			discord: formData.get("discord") ?? undefined,
			twitch: formData.get("twitch") ?? undefined,
			youtube: formData.get("youtube") ?? undefined,
		},
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { displayName, bio, socialLinks } = parsed.output;

	// Build socialLinks only with non-empty values
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

	revalidatePath("/dashboard");
	revalidatePath("/dashboard/profile");
	return { success: true };
}

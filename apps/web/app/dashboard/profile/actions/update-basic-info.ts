"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiPatch } from "@/lib/api-client";

export async function updateBasicInfoAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const res = await apiPatch("/api/profile/basic", {
		displayName: String(formData.get("displayName") ?? ""),
		bio: formData.get("bio") ?? undefined,
		socialLinks: {
			twitter: formData.get("twitter") ?? undefined,
			discord: formData.get("discord") ?? undefined,
			twitch: formData.get("twitch") ?? undefined,
			youtube: formData.get("youtube") ?? undefined,
		},
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard");
	revalidatePath("/dashboard/profile");
	return { success: true };
}

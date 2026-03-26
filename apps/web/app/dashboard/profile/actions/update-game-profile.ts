"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiPatch } from "@/lib/api-client";

export async function updateGameProfileAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const rawDivision = formData.get("rankDivision");

	const res = await apiPatch("/api/profile/game", {
		battletag: formData.get("battletag") || undefined,
		primaryRole: String(formData.get("primaryRole") ?? ""),
		secondaryRole: formData.get("secondaryRole") || null,
		rank: formData.get("rank") || null,
		rankDivision: rawDivision ? Number(rawDivision) : null,
		heroPool: formData.getAll("heroPool[]") as string[],
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard");
	revalidatePath("/dashboard/personal/profile");
	return { success: true };
}

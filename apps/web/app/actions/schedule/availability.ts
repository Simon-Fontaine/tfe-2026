"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

function revalidateScheduleSurfaces(teamId: string) {
	revalidatePath(appRoutes.root);
	revalidatePath(appRoutes.calendar);
	revalidatePath(appRoutes.teams.calendar(teamId));
}

export async function addAvailabilityAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost(apiRoutes.schedule.availability.root, {
		teamId,
		type: String(formData.get("type") ?? ""),
		dayOfWeek: formData.get("dayOfWeek") !== null ? Number(formData.get("dayOfWeek")) : null,
		specificDate: formData.get("specificDate") || null,
		startTime: String(formData.get("startTime") ?? ""),
		endTime: String(formData.get("endTime") ?? ""),
		timezone: String(formData.get("timezone") ?? ""),
		label: formData.get("label") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateScheduleSurfaces(teamId);
	return { success: true };
}

export async function deleteAvailabilityAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const id = String(formData.get("id") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiDelete(apiRoutes.schedule.availability.byId(id));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	if (teamId) {
		revalidateScheduleSurfaces(teamId);
	} else {
		revalidatePath(appRoutes.root);
		revalidatePath(appRoutes.calendar);
	}
	return { success: true };
}

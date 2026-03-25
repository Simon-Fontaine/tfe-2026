"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiPost } from "@/lib/api-client";

export async function markNotificationReadAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const notificationId = String(formData.get("notificationId") ?? "");
	const res = await apiPost(`/api/notifications/${notificationId}/read`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/me/notifications");
	return { success: true };
}

export async function markAllNotificationsReadAction(
	_prev: FormActionResult | null,
	_formData: FormData
): Promise<FormActionResult> {
	const res = await apiPost("/api/notifications/read-all");
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/me/notifications");
	return { success: true };
}

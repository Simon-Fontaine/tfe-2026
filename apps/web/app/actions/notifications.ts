"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiPost } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";

function revalidateNotificationSurfaces() {
	revalidatePath(appRoutes.inbox);
}

export async function markNotificationReadAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const notificationId = String(formData.get("notificationId") ?? "");
	const res = await apiPost(apiRoutes.notifications.read(notificationId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateNotificationSurfaces();
	return { success: true };
}

export async function markAllNotificationsReadAction(
	_prev: FormActionResult | null,
	_formData: FormData
): Promise<FormActionResult> {
	const res = await apiPost(apiRoutes.notifications.readAll);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateNotificationSurfaces();
	return { success: true };
}

export async function markNotificationUnreadAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const notificationId = String(formData.get("notificationId") ?? "");
	const res = await apiPost(apiRoutes.notifications.unread(notificationId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateNotificationSurfaces();
	return { success: true };
}

export async function dismissNotificationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const notificationId = String(formData.get("notificationId") ?? "");
	const res = await apiPost(apiRoutes.notifications.dismiss(notificationId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateNotificationSurfaces();
	return { success: true };
}

export async function restoreNotificationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const notificationId = String(formData.get("notificationId") ?? "");
	const res = await apiPost(apiRoutes.notifications.restore(notificationId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateNotificationSurfaces();
	return { success: true };
}

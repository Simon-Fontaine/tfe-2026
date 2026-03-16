"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { notificationTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { getCurrentSession } from "@/lib/auth/session";

export async function markNotificationReadAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const notificationId = formData.get("notificationId");
	if (typeof notificationId !== "string") return { error: "Invalid notification ID." };

	await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(and(eq(notificationTable.id, notificationId), eq(notificationTable.userId, user.id)));

	revalidatePath("/dashboard/notifications");
	return { success: true };
}

export async function markAllNotificationsReadAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	// formData is unused but required by the Server Action signature
	void formData;

	await db
		.update(notificationTable)
		.set({ isRead: true })
		.where(eq(notificationTable.userId, user.id));

	revalidatePath("/dashboard/notifications");
	return { success: true };
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import { availabilityTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { AvailabilitySchema } from "@/lib/validations/profile";

export async function addAvailabilityAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return { error: "You must be signed in." };
	}

	const parsed = v.safeParse(AvailabilitySchema, {
		type: formData.get("type"),
		dayOfWeek: formData.get("dayOfWeek") !== null ? Number(formData.get("dayOfWeek")) : null,
		specificDate: formData.get("specificDate") || null,
		startTime: formData.get("startTime"),
		endTime: formData.get("endTime"),
		timezone: formData.get("timezone"),
		label: formData.get("label") || undefined,
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { type, dayOfWeek, specificDate, startTime, endTime, timezone, label } = parsed.output;

	await db.insert(availabilityTable).values({
		userId: user.id,
		dayOfWeek: type === "recurring" ? (dayOfWeek ?? null) : null,
		specificDate: type === "one_off" && specificDate ? new Date(specificDate) : null,
		startTime,
		endTime,
		timezone,
		label: label || null,
	});

	revalidatePath("/dashboard/profile");
	return { success: true };
}

export async function deleteAvailabilityAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return { error: "You must be signed in." };
	}

	const id = formData.get("id") as string;
	if (!id) return { error: "Missing availability ID." };

	const row = await db.query.availabilityTable.findFirst({
		where: eq(availabilityTable.id, id),
		columns: { userId: true },
	});

	if (!row) return { error: "Availability window not found." };
	if (row.userId !== user.id) return { error: "Not authorized." };

	await db.delete(availabilityTable).where(eq(availabilityTable.id, id));

	revalidatePath("/dashboard/profile");
	return { success: true };
}

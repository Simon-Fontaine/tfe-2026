"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { db } from "@/db";
import { teamRosterTable, teamTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { verifyOrgManager } from "@/lib/data/organization";
import {
	AddPlayerSchema,
	RemoveRosterMemberSchema,
	UpdateRosterStatusSchema,
} from "@/lib/validations/org";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getOrgIdForTeam(teamId: string): Promise<string | null> {
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { organizationId: true },
	});
	return team?.organizationId ?? null;
}

async function getOrgIdForRoster(
	rosterId: string
): Promise<{ orgId: string; teamId: string } | null> {
	const row = await db.query.teamRosterTable.findFirst({
		where: eq(teamRosterTable.id, rosterId),
		columns: { teamId: true },
	});
	if (!row) return null;
	const orgId = await getOrgIdForTeam(row.teamId);
	if (!orgId) return null;
	return { orgId, teamId: row.teamId };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function addPlayerAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(AddPlayerSchema, {
		teamId: formData.get("teamId"),
		orgId: formData.get("orgId"),
		userId: formData.get("userId"),
		roleInTeam: formData.get("roleInTeam"),
		status: formData.get("status"),
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { teamId, orgId, userId, roleInTeam, status } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to manage this team's roster." };

	// Upsert: update if the user already has a row (including inactive), otherwise insert.
	const existing = await db.query.teamRosterTable.findFirst({
		where: and(eq(teamRosterTable.teamId, teamId), eq(teamRosterTable.userId, userId)),
		columns: { id: true },
	});

	if (existing) {
		await db
			.update(teamRosterTable)
			.set({ roleInTeam, status, leftAt: null })
			.where(eq(teamRosterTable.id, existing.id));
	} else {
		await db.insert(teamRosterTable).values({ teamId, userId, roleInTeam, status });
	}

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function updateRosterStatusAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(UpdateRosterStatusSchema, {
		rosterId: formData.get("rosterId"),
		status: formData.get("status"),
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { rosterId, status } = parsed.output;

	const ctx = await getOrgIdForRoster(rosterId);
	if (!ctx) return { error: "Roster member not found." };

	const isManager = await verifyOrgManager(ctx.orgId, user.id);
	if (!isManager) return { error: "You do not have permission to manage this team's roster." };

	await db.update(teamRosterTable).set({ status }).where(eq(teamRosterTable.id, rosterId));

	revalidatePath(`/dashboard/teams/${ctx.teamId}`);
	return { success: true };
}

export async function removeRosterMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(RemoveRosterMemberSchema, {
		rosterId: formData.get("rosterId"),
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { rosterId } = parsed.output;

	const ctx = await getOrgIdForRoster(rosterId);
	if (!ctx) return { error: "Roster member not found." };

	const isManager = await verifyOrgManager(ctx.orgId, user.id);
	if (!isManager) return { error: "You do not have permission to manage this team's roster." };

	await db
		.update(teamRosterTable)
		.set({ status: "inactive", leftAt: new Date() })
		.where(eq(teamRosterTable.id, rosterId));

	revalidatePath(`/dashboard/teams/${ctx.teamId}`);
	return { success: true };
}

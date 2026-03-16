"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as v from "valibot";

import { db } from "@/db";
import { teamTable } from "@/db/schema";
import type { FormActionResult } from "@/hooks/use-form-action";
import { extractErrors } from "@/lib/action-utils";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserOrgRole, verifyOrgManager } from "@/lib/data/organization";
import {
	ArchiveTeamSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	ToggleRecruitingSchema,
	UpdateTeamSchema,
} from "@/lib/validations/org";

export async function createTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { teamId?: string }> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(CreateTeamSchema, {
		orgId: formData.get("orgId"),
		name: formData.get("name"),
		tag: formData.get("tag"),
		description: formData.get("description") || undefined,
	});

	if (!parsed.success) {
		return { fieldErrors: extractErrors(parsed.issues) };
	}

	const { orgId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager)
		return { error: "You do not have permission to create teams in this organisation." };

	const [team] = await db
		.insert(teamTable)
		.values({
			organizationId: orgId,
			name,
			tag: tag.toUpperCase(),
			description: description || null,
		})
		.returning({ id: teamTable.id });

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true, teamId: team.id };
}

export async function updateTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(UpdateTeamSchema, {
		orgId: formData.get("orgId"),
		teamId: formData.get("teamId"),
		name: formData.get("name"),
		tag: formData.get("tag"),
		description: formData.get("description") || undefined,
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, teamId, name, tag, description } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to edit this team." };

	await db
		.update(teamTable)
		.set({ name, tag: tag.toUpperCase(), description: description || null })
		.where(eq(teamTable.id, teamId));

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function toggleRecruitingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(ToggleRecruitingSchema, {
		orgId: formData.get("orgId"),
		teamId: formData.get("teamId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, teamId } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to manage this team." };

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { isRecruiting: true },
	});
	if (!team) return { error: "Team not found." };

	await db
		.update(teamTable)
		.set({ isRecruiting: !team.isRecruiting })
		.where(eq(teamTable.id, teamId));

	revalidatePath(`/dashboard/teams/${teamId}`);
	revalidatePath("/dashboard/teams");
	return { success: true };
}

export async function archiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(ArchiveTeamSchema, {
		orgId: formData.get("orgId"),
		teamId: formData.get("teamId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, teamId } = parsed.output;

	const isManager = await verifyOrgManager(orgId, user.id);
	if (!isManager) return { error: "You do not have permission to archive this team." };

	await db
		.update(teamTable)
		.set({ isArchived: true, isRecruiting: false })
		.where(eq(teamTable.id, teamId));

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function deleteTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const { session, user } = await getCurrentSession();
	if (!session || !user) return { error: "You must be signed in." };

	const parsed = v.safeParse(DeleteTeamSchema, {
		orgId: formData.get("orgId"),
		teamId: formData.get("teamId"),
	});
	if (!parsed.success) return { fieldErrors: extractErrors(parsed.issues) };

	const { orgId, teamId } = parsed.output;

	const role = await getUserOrgRole(orgId, user.id);
	if (role !== "owner") return { error: "Only the organisation owner can delete teams." };

	await db.delete(teamTable).where(eq(teamTable.id, teamId));

	revalidatePath(`/dashboard/orgs/${orgId}`);
	redirect(`/dashboard/orgs/${orgId}`);
}

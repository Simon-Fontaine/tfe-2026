"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";

export async function createTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { teamId?: string }> {
	const orgId = String(formData.get("orgId") ?? "");
	const res = await apiPost<{ teamId: string }>("/api/teams", {
		orgId,
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true, teamId: res.teamId };
}

export async function updateTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPatch(`/api/teams/${teamId}`, {
		orgId: String(formData.get("orgId") ?? ""),
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function toggleRecruitingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPatch(`/api/teams/${teamId}/recruiting`, {
		orgId: String(formData.get("orgId") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/teams/${teamId}`);
	revalidatePath("/dashboard/teams");
	return { success: true };
}

export async function archiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost(`/api/teams/${teamId}/archive`, { orgId });
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function deleteTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiDelete(`/api/teams/${teamId}`, { orgId });
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	redirect(`/dashboard/orgs/${orgId}`);
}

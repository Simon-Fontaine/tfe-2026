"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";

export async function createTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { teamId?: string }> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.create({
		orgId,
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true, teamId: actionResult.data.teamId };
}

export async function updateTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.update({
		teamId,
		orgId: String(formData.get("orgId") ?? ""),
		name: String(formData.get("name") ?? ""),
		tag: String(formData.get("tag") ?? ""),
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true };
}

export async function toggleRecruitingAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const teamId = String(formData.get("teamId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.toggleRecruiting({
		teamId,
		orgId: String(formData.get("orgId") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/dashboard/teams/${teamId}`);
	revalidatePath("/dashboard/teams");
	return { success: true };
}

export async function archiveTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.archive({
		teamId: String(formData.get("teamId") ?? ""),
		orgId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function deleteTeamAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.teams.delete({
		teamId: String(formData.get("teamId") ?? ""),
		orgId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/dashboard/orgs/${orgId}`);
	redirect(`/dashboard/orgs/${orgId}`);
}

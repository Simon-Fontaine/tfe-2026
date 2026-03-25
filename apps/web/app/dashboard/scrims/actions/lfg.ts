"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { apiRoutes, dashboardRoutes } from "@/lib/routes";

function getRequiredString(formData: FormData, key: string): string | null {
	const value = String(formData.get(key) ?? "").trim();
	return value.length > 0 ? value : null;
}

function missingFieldError(key: string): FormActionResult {
	return { error: "Missing required form data.", fieldErrors: { [key]: ["Required"] } };
}

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

function revalidateLfgRoutes({
	orgId,
	teamId,
}: {
	orgId?: string | null;
	teamId?: string | null;
} = {}) {
	revalidatePath(dashboardRoutes.recruit.lfg);
	if (orgId && teamId) revalidatePath(dashboardRoutes.workspace.teamById(orgId, teamId));
}

export async function createLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const teamId = getRequiredString(formData, "teamId");
	if (!teamId) return missingFieldError("teamId");
	const orgId = await getVerifiedTeamOrgId(teamId);

	const res = await apiPost<{ postId: string }>(apiRoutes.lfg.root, {
		teamId,
		rolesNeeded: formData.getAll("rolesNeeded") as string[],
		minRank: formData.get("minRank") || undefined,
		maxRank: formData.get("maxRank") || undefined,
		description: formData.get("description") || undefined,
		region: formData.get("region") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes({ orgId, teamId });
	return { success: true, postId: res.postId };
}

export async function closeLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = getRequiredString(formData, "postId");
	if (!postId) return missingFieldError("postId");
	const teamId = getRequiredString(formData, "teamId");
	const orgId = teamId ? await getVerifiedTeamOrgId(teamId) : null;

	const res = await apiPost(apiRoutes.lfg.close(postId), {
		postId,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes({ orgId, teamId });
	return { success: true };
}

export async function applyToLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = getRequiredString(formData, "postId");
	if (!postId) return missingFieldError("postId");

	const res = await apiPost(apiRoutes.lfg.apply(postId), {
		postId,
		message: formData.get("message") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes();
	return { success: true };
}

export async function withdrawApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = getRequiredString(formData, "postId");
	if (!postId) return missingFieldError("postId");
	const applicationId = getRequiredString(formData, "applicationId");
	if (!applicationId) return missingFieldError("applicationId");
	const res = await apiDelete(apiRoutes.lfg.applicationById(postId, applicationId));
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes();
	return { success: true };
}

export async function respondToApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = getRequiredString(formData, "postId");
	if (!postId) return missingFieldError("postId");
	const applicationId = getRequiredString(formData, "applicationId");
	if (!applicationId) return missingFieldError("applicationId");
	const teamId = getRequiredString(formData, "teamId");
	if (!teamId) return missingFieldError("teamId");
	const orgId = await getVerifiedTeamOrgId(teamId);
	const action = getRequiredString(formData, "action");
	if (!action) return missingFieldError("action");

	const res = await apiPost(apiRoutes.lfg.respondToApplication(postId, applicationId), {
		applicationId,
		action,
		roleInTeam: formData.get("roleInTeam") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes({ orgId, teamId });
	return { success: true };
}

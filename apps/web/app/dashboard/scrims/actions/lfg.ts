"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";

function getRequiredString(formData: FormData, key: string): string | null {
	const value = String(formData.get(key) ?? "").trim();
	return value.length > 0 ? value : null;
}

function missingFieldError(key: string): FormActionResult {
	return { error: "Missing required form data.", fieldErrors: { [key]: ["Required"] } };
}

function revalidateLfgRoutes({
	orgId,
	teamId,
}: {
	orgId?: string | null;
	teamId?: string | null;
} = {}) {
	revalidatePath("/dashboard/recruit/lfg");
	if (orgId && teamId) revalidatePath(`/dashboard/workspace/orgs/${orgId}/teams/${teamId}`);
}

export async function createLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const teamId = getRequiredString(formData, "teamId");
	if (!teamId) return missingFieldError("teamId");
	const orgId = getRequiredString(formData, "orgId");
	if (!orgId) return missingFieldError("orgId");

	const res = await apiPost<{ postId: string }>("/api/lfg", {
		teamId,
		orgId,
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
	const orgId = getRequiredString(formData, "orgId");
	if (!orgId) return missingFieldError("orgId");

	const res = await apiPost(`/api/lfg/${postId}/close`, {
		orgId,
		postId,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes({ orgId, teamId: getRequiredString(formData, "teamId") });
	return { success: true };
}

export async function applyToLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = getRequiredString(formData, "postId");
	if (!postId) return missingFieldError("postId");

	const res = await apiPost(`/api/lfg/${postId}/apply`, {
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
	const res = await apiDelete(`/api/lfg/${postId}/applications/${applicationId}`);
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
	const orgId = getRequiredString(formData, "orgId");
	if (!orgId) return missingFieldError("orgId");
	const action = getRequiredString(formData, "action");
	if (!action) return missingFieldError("action");

	const res = await apiPost(`/api/lfg/${postId}/applications/${applicationId}/respond`, {
		applicationId,
		orgId,
		action,
		roleInTeam: formData.get("roleInTeam") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidateLfgRoutes({ orgId, teamId: getRequiredString(formData, "teamId") });
	return { success: true };
}

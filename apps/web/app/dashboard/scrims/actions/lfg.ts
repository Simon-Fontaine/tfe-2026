"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPost } from "@/lib/api-client";

export async function createLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const teamId = String(formData.get("teamId") ?? "");
	const res = await apiPost<{ postId: string }>("/api/lfg", {
		teamId,
		orgId: String(formData.get("orgId") ?? ""),
		rolesNeeded: formData.getAll("rolesNeeded") as string[],
		minRank: formData.get("minRank") || undefined,
		maxRank: formData.get("maxRank") || undefined,
		description: formData.get("description") || undefined,
		region: formData.get("region") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/scrims");
	revalidatePath(`/dashboard/teams/${teamId}`);
	return { success: true, postId: res.postId };
}

export async function closeLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = String(formData.get("postId") ?? "");
	const res = await apiPost(`/api/lfg/${postId}/close`, {
		orgId: String(formData.get("orgId") ?? ""),
		postId,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function applyToLfgPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = String(formData.get("postId") ?? "");
	const res = await apiPost(`/api/lfg/${postId}/apply`, {
		postId,
		message: formData.get("message") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function withdrawApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = String(formData.get("postId") ?? "");
	const applicationId = String(formData.get("applicationId") ?? "");
	const res = await apiDelete(`/api/lfg/${postId}/applications/${applicationId}`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/scrims");
	return { success: true };
}

export async function respondToApplicationAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const postId = String(formData.get("postId") ?? "");
	const applicationId = String(formData.get("applicationId") ?? "");
	const res = await apiPost(`/api/lfg/${postId}/applications/${applicationId}/respond`, {
		applicationId,
		orgId: String(formData.get("orgId") ?? ""),
		action: String(formData.get("action") ?? ""),
		roleInTeam: formData.get("roleInTeam") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/scrims");
	revalidatePath(`/dashboard/teams/${formData.get("teamId") ?? ""}`);
	return { success: true };
}

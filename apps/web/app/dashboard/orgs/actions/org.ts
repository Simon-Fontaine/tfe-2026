"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { orgId?: string }> {
	const res = await apiPost<{ orgId: string }>("/api/orgs", {
		name: String(formData.get("name") ?? ""),
		description: formData.get("description") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/orgs");
	return { success: true, orgId: res.orgId };
}

export async function updateOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const res = await apiPatch(`/api/orgs/${orgId}`, {
		name: String(formData.get("name") ?? ""),
		description: formData.get("description") || undefined,
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function deleteOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const res = await apiDelete(`/api/orgs/${orgId}`, {
		confirmName: String(formData.get("confirmName") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/orgs");
	redirect("/dashboard/orgs");
}

export async function updateOrgMemberRoleAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const memberId = String(formData.get("memberId") ?? "");
	const res = await apiPatch(`/api/orgs/${orgId}/members/${memberId}/role`, {
		role: String(formData.get("role") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function removeOrgMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const memberId = String(formData.get("memberId") ?? "");
	const res = await apiDelete(`/api/orgs/${orgId}/members/${memberId}`);
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function inviteToOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const res = await apiPost(`/api/orgs/${orgId}/invites`, {
		userId: String(formData.get("userId") ?? ""),
		role: String(formData.get("role") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath(`/dashboard/orgs/${orgId}`);
	return { success: true };
}

export async function respondToOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const res = await apiPost(`/api/orgs/invites/${inviteId}/respond`, {
		action: String(formData.get("action") ?? ""),
	});
	if ("error" in res) return { error: res.error, fieldErrors: res.fieldErrors };

	revalidatePath("/dashboard/invitations");
	revalidatePath("/dashboard/orgs");
	return { success: true };
}

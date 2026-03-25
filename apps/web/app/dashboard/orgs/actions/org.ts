"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import { dashboardRoutes } from "@/lib/routes";

export async function createOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { orgId?: string }> {
	const sdk = getServerSdk();
	const result = await sdk.orgs.create({
		name: String(formData.get("name") ?? ""),
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgs);
	return { success: true, orgId: actionResult.data.orgId };
}

export async function updateOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.update({
		orgId,
		name: String(formData.get("name") ?? ""),
		slug: formData.get("slug")?.toString() || undefined,
		description: formData.get("description")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function transferOrgOwnershipAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.transferOwnership({
		orgId,
		memberId: String(formData.get("memberId") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	revalidatePath(dashboardRoutes.workspace.orgs);
	return { success: true };
}

export async function deleteOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.delete({
		orgId,
		confirmName: String(formData.get("confirmName") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgs);
	redirect(dashboardRoutes.workspace.orgs);
}

export async function leaveOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.leave({ orgId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgs);
	redirect(dashboardRoutes.workspace.orgs);
}

export async function updateOrgMemberRoleAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.updateMemberRole({
		orgId,
		memberId: String(formData.get("memberId") ?? ""),
		role: String(formData.get("role") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function createOrgJoinRequestAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.requestToJoin({
		orgId,
		message: formData.get("message")?.toString() || undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(`/orgs/${orgId}`);
	return { success: true };
}

export async function respondToOrgJoinRequestAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.respondToRequest({
		orgId,
		requestId: String(formData.get("requestId") ?? ""),
		action: String(formData.get("action") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function removeOrgMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.removeMember({
		orgId,
		memberId: String(formData.get("memberId") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function inviteToOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.invite({
		orgId,
		userId: String(formData.get("userId") ?? ""),
		role: String(formData.get("role") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function respondToOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.orgs.respondToInvite({
		inviteId: String(formData.get("inviteId") ?? ""),
		action: String(formData.get("action") ?? ""),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.recruit.invitations);
	revalidatePath(dashboardRoutes.workspace.orgs);
	return { success: true };
}

export async function cancelOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const inviteId = String(formData.get("inviteId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.cancelInvite({ orgId, inviteId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

export async function resendOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const inviteId = String(formData.get("inviteId") ?? "");
	const sdk = getServerSdk();
	const result = await sdk.orgs.resendInvite({ orgId, inviteId });

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.workspace.orgById(orgId));
	return { success: true };
}

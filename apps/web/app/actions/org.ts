"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormActionResult } from "@/hooks/use-form-action";
import { isApiActionError, toFormActionError } from "@/lib/action-result";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { apiRoutes, appRoutes, publicRoutes } from "@/lib/routes";

async function getOrgSlug(orgId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const org = await getOrgWithTeams(orgId, user.id);
	return org?.slug ?? null;
}

async function revalidateOrg(orgId: string) {
	revalidatePath(appRoutes.recruiting.root);
	revalidatePath(appRoutes.orgs.root);
	revalidatePath(appRoutes.orgs.byId(orgId));
	revalidatePath(appRoutes.orgs.teams(orgId));
	revalidatePath(appRoutes.orgs.staff(orgId));
	revalidatePath(appRoutes.orgs.brand(orgId));
	revalidatePath(appRoutes.orgs.settings(orgId));
	revalidatePath(publicRoutes.orgs.root);
	revalidatePath(publicRoutes.recruiting.root);

	const slug = await getOrgSlug(orgId);
	if (slug) revalidatePath(publicRoutes.orgs.bySlug(slug));
}

export async function createOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { orgId?: string }> {
	const result = await apiPost<{ orgId: string }>(apiRoutes.orgs.root, {
		name: String(formData.get("name") ?? ""),
		description: formData.get("description")?.toString() || undefined,
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidatePath(appRoutes.orgs.root);
	await revalidateOrg(result.orgId);
	return { success: true, orgId: result.orgId };
}

export async function updateOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiPatch(apiRoutes.orgs.byId(orgId), {
		name: String(formData.get("name") ?? ""),
		slug: formData.get("slug")?.toString() || undefined,
		description: formData.get("description")?.toString() || undefined,
		avatarUrl: formData.get("avatarUrl")?.toString() || undefined,
		bannerUrl: formData.get("bannerUrl")?.toString() || undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

export async function transferOrgOwnershipAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiPost(apiRoutes.orgs.transferOwnership(orgId), {
		memberId: String(formData.get("memberId") ?? ""),
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	revalidatePath(appRoutes.orgs.root);
	return { success: true };
}

export async function deleteOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const slug = await getOrgSlug(orgId);
	const result = await apiDelete(apiRoutes.orgs.byId(orgId), {
		confirmName: String(formData.get("confirmName") ?? ""),
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidatePath(appRoutes.orgs.root);
	revalidatePath(publicRoutes.orgs.root);
	if (slug) revalidatePath(publicRoutes.orgs.bySlug(slug));
	redirect(appRoutes.orgs.root);
}

export async function leaveOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiDelete(apiRoutes.orgs.leave(orgId));
	if (isApiActionError(result)) return toFormActionError(result);

	revalidatePath(appRoutes.orgs.root);
	redirect(appRoutes.orgs.root);
}

export async function updateOrgMemberRoleAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiPatch(
		apiRoutes.orgs.members.role(orgId, String(formData.get("memberId") ?? "")),
		{
			role: formData.get("role")?.toString() || undefined,
			memberType:
				(formData.get("memberType")?.toString() as "player" | "staff" | undefined) ?? undefined,
			staffRole:
				(formData.get("staffRole")?.toString() as
					| "coach"
					| "analyst"
					| "manager"
					| "staff"
					| undefined) ?? undefined,
			gameRole:
				(formData.get("gameRole")?.toString() as "tank" | "damage" | "support" | undefined) ??
				undefined,
		}
	);
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

export async function removeOrgMemberAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiDelete(
		apiRoutes.orgs.members.byId(orgId, String(formData.get("memberId") ?? ""))
	);
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

export async function inviteToOrgAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const result = await apiPost(apiRoutes.orgs.invites.pending(orgId), {
		userId: String(formData.get("userId") ?? ""),
		role: String(formData.get("role") ?? ""),
		memberType:
			(formData.get("memberType")?.toString() as "player" | "staff" | undefined) ?? undefined,
		staffRole:
			(formData.get("staffRole")?.toString() as
				| "coach"
				| "analyst"
				| "manager"
				| "staff"
				| undefined) ?? undefined,
		gameRole:
			(formData.get("gameRole")?.toString() as "tank" | "damage" | "support" | undefined) ??
			undefined,
	});
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

export async function respondToOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const inviteId = String(formData.get("inviteId") ?? "");
	const result = await apiPost(apiRoutes.orgs.invites.respond(inviteId), {
		action: String(formData.get("action") ?? ""),
	});
	if (isApiActionError(result)) return toFormActionError(result);

	revalidatePath(appRoutes.inbox);
	revalidatePath(appRoutes.orgs.root);
	return { success: true };
}

export async function cancelOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const inviteId = String(formData.get("inviteId") ?? "");
	const result = await apiDelete(apiRoutes.orgs.invites.cancel(orgId, inviteId));
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

export async function resendOrgInviteAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const orgId = String(formData.get("orgId") ?? "");
	const inviteId = String(formData.get("inviteId") ?? "");
	const result = await apiPost(apiRoutes.orgs.invites.resend(orgId, inviteId));
	if (isApiActionError(result)) return toFormActionError(result);

	await revalidateOrg(orgId);
	return { success: true };
}

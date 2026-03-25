"use server";

import { revalidatePath } from "next/cache";

import type { FormActionResult } from "@/hooks/use-form-action";
import { toActionResult } from "@/lib/action-result";
import { getServerSdk } from "@/lib/app-sdk";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

function getString(formData: FormData, key: string): string {
	return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string): string | undefined {
	const value = getString(formData, key);
	return value.length > 0 ? value : undefined;
}

function getOptionalNumber(formData: FormData, key: string): number | undefined {
	const value = getOptionalString(formData, key);
	if (!value) return undefined;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}

function getGameRoles(formData: FormData) {
	return formData
		.getAll("gameRoles")
		.map((value) => String(value))
		.filter(
			(value): value is "tank" | "damage" | "support" =>
				value === "tank" || value === "damage" || value === "support"
		);
}

async function getVerifiedTeamOrgId(teamId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) return null;
	return team.organizationId;
}

async function getOrgSlug(orgId: string): Promise<string | null> {
	const { user } = await getCurrentSession();
	if (!user) return null;
	const org = await getOrgWithTeams(orgId, user.id);
	return org?.slug ?? null;
}

async function revalidateRecruitPaths(input: {
	teamId?: string;
	orgId?: string;
	playerUsername?: string;
}) {
	revalidatePath(dashboardRoutes.recruit.posts);
	revalidatePath(dashboardRoutes.recruit.conversations);
	revalidatePath("/posts");
	revalidatePath("/players");

	if (input.playerUsername) revalidatePath(`/players/${input.playerUsername}`);

	if (input.teamId) {
		revalidatePath(`/teams/${input.teamId}`);
		const orgId = input.orgId ?? (await getVerifiedTeamOrgId(input.teamId));
		if (orgId) {
			revalidatePath(dashboardRoutes.workspace.teamById(orgId, input.teamId));
			revalidatePath(dashboardRoutes.workspace.orgById(orgId));
			const slug = await getOrgSlug(orgId);
			if (slug) revalidatePath(`/orgs/${slug}`);
		}
		return;
	}

	if (input.orgId) {
		revalidatePath(dashboardRoutes.workspace.orgById(input.orgId));
		const slug = await getOrgSlug(input.orgId);
		if (slug) revalidatePath(`/orgs/${slug}`);
	}
}

export async function createRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { postId?: string }> {
	const sdk = getServerSdk();
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const ownerType =
		(getOptionalString(formData, "ownerType") as "player" | "team" | "organization" | undefined) ??
		"player";
	const memberType =
		(getOptionalString(formData, "memberType") as "player" | "staff" | undefined) ?? "player";
	const teamId = getOptionalString(formData, "teamId");
	const organizationId = getOptionalString(formData, "organizationId");

	const result = await sdk.recruit.createPost({
		category: getString(formData, "category") as "lft" | "lfp" | "lfr" | "lfs",
		ownerType,
		title: getString(formData, "title"),
		description: getOptionalString(formData, "description"),
		memberType,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
		gameRoles: getGameRoles(formData),
		minRank: getOptionalString(formData, "minRank"),
		maxRank: getOptionalString(formData, "maxRank"),
		minSr: getOptionalNumber(formData, "minSr"),
		maxSr: getOptionalNumber(formData, "maxSr"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
		teamId,
		organizationId,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId,
		orgId: organizationId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true, postId: actionResult.data.postId };
}

export async function updateRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const postId = getString(formData, "postId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");

	const result = await sdk.recruit.updatePost({
		postId,
		category: getOptionalString(formData, "category") as "lft" | "lfp" | "lfr" | "lfs" | undefined,
		status: getOptionalString(formData, "status") as
			| "open"
			| "closed"
			| "fulfilled"
			| "expired"
			| undefined,
		title: getOptionalString(formData, "title"),
		description: getOptionalString(formData, "description"),
		memberType: getOptionalString(formData, "memberType") as "player" | "staff" | undefined,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
		gameRoles: getGameRoles(formData),
		minRank: getOptionalString(formData, "minRank"),
		maxRank: getOptionalString(formData, "maxRank"),
		minSr: getOptionalNumber(formData, "minSr"),
		maxSr: getOptionalNumber(formData, "maxSr"),
		region: getOptionalString(formData, "region"),
		expiresAt: getOptionalString(formData, "expiresAt"),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({ teamId, orgId });
	return { success: true };
}

export async function deleteRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const { user } = await getCurrentSession();
	if (!user) return { error: "You must be signed in." };

	const postId = getString(formData, "postId");
	const teamId = getOptionalString(formData, "teamId");
	const orgId = getOptionalString(formData, "organizationId");
	const ownerType = getOptionalString(formData, "ownerType");

	const result = await sdk.recruit.deletePost({ postId });
	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId,
		orgId,
		playerUsername: ownerType === "player" ? user.username : undefined,
	});
	return { success: true };
}

export async function respondToRecruitmentPostAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult & { threadId?: string; responseId?: string }> {
	const sdk = getServerSdk();
	const postId = getString(formData, "postId");
	const result = await sdk.recruit.respondToPost({
		postId,
		message: getOptionalString(formData, "message"),
		senderTeamId: getOptionalString(formData, "senderTeamId"),
		senderOrganizationId: getOptionalString(formData, "senderOrganizationId"),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({});
	return {
		success: true,
		threadId: actionResult.data.threadId,
		responseId: actionResult.data.responseId,
	};
}

export async function withdrawRecruitmentResponseAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const responseId = getString(formData, "responseId");
	const result = await sdk.recruit.withdrawResponse({ responseId });
	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({});
	return { success: true };
}

export async function decideRecruitmentResponseAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const responseId = getString(formData, "responseId");
	const result = await sdk.recruit.decideResponse({
		responseId,
		action: getString(formData, "action") as "accept" | "reject",
		gameRole: getOptionalString(formData, "gameRole") as "tank" | "damage" | "support" | undefined,
		staffRole: getOptionalString(formData, "staffRole") as
			| "coach"
			| "analyst"
			| "manager"
			| "staff"
			| undefined,
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	await revalidateRecruitPaths({
		teamId: getOptionalString(formData, "teamId"),
		orgId: getOptionalString(formData, "organizationId"),
	});
	return { success: true };
}

export async function sendRecruitmentMessageAction(
	_prev: FormActionResult | null,
	formData: FormData
): Promise<FormActionResult> {
	const sdk = getServerSdk();
	const result = await sdk.recruit.sendMessage({
		threadId: getString(formData, "threadId"),
		content: getString(formData, "content"),
	});

	const actionResult = toActionResult(result);
	if (!("data" in actionResult)) return actionResult;

	revalidatePath(dashboardRoutes.recruit.conversations);
	return { success: true };
}

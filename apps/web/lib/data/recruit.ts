import type {
	RecruitmentPostCategory,
	RecruitmentPostSummary,
	RecruitmentResponseSummary,
} from "@scrimflow/shared";
import { cache } from "react";

import { apiGet } from "@/lib/api-client";
import type { RecruitEntityOption } from "@/lib/recruitment";
import { apiRoutes } from "@/lib/routes";
import { getOrgsForUser, getOrgWithTeams } from "./organization";

export type { RecruitmentPostCategory, RecruitmentPostSummary, RecruitmentResponseSummary };

export const getManageableRecruitEntities = cache(
	async (userId: string): Promise<RecruitEntityOption[]> => {
		const orgs = (await getOrgsForUser(userId)).filter((org) => org.canManage);
		const orgDetails = await Promise.all(orgs.map((org) => getOrgWithTeams(org.id, userId)));

		return orgDetails.flatMap((org) => {
			if (!org) return [];

			const orgOption: RecruitEntityOption = {
				id: org.id,
				type: "organization",
				label: `${org.name} organisation`,
			};

			const teamOptions: RecruitEntityOption[] = org.activeTeams.map((team) => ({
				id: team.id,
				type: "team",
				label: `[${team.tag}] ${team.name}`,
				organizationId: org.id,
			}));

			return [orgOption, ...teamOptions];
		});
	}
);

export const getRecruitmentPosts = cache(
	async (
		filters: {
			category?: RecruitmentPostCategory;
			memberType?: "player" | "staff";
			ownerType?: "player" | "team" | "organization";
			teamId?: string;
			organizationId?: string;
		} = {}
	): Promise<RecruitmentPostSummary[]> => {
		const params = new URLSearchParams();
		if (filters.category) params.set("category", filters.category);
		if (filters.memberType) params.set("memberType", filters.memberType);
		if (filters.ownerType) params.set("ownerType", filters.ownerType);
		if (filters.teamId) params.set("teamId", filters.teamId);
		if (filters.organizationId) params.set("organizationId", filters.organizationId);

		const qs = params.toString();
		const res = await apiGet<RecruitmentPostSummary[]>(
			`${apiRoutes.posts.root}${qs ? `?${qs}` : ""}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getMyRecruitmentPosts = cache(async (): Promise<RecruitmentPostSummary[]> => {
	const res = await apiGet<RecruitmentPostSummary[]>(apiRoutes.posts.mine);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getMyRecruitmentResponses = cache(async (): Promise<RecruitmentResponseSummary[]> => {
	const res = await apiGet<RecruitmentResponseSummary[]>(apiRoutes.responses.mine);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getRecruitmentResponsesForPost = cache(
	async (postId: string): Promise<RecruitmentResponseSummary[]> => {
		const res = await apiGet<RecruitmentResponseSummary[]>(apiRoutes.posts.responses(postId));
		if ("data" in res) return res.data;
		if (res.status === 403 || res.status === 404) return [];
		throw new Error(res.error);
	}
);

export const getPublicRecruitmentPosts = cache(
	async (
		filters: {
			category?: RecruitmentPostCategory;
			memberType?: "player" | "staff";
			region?: string;
		} = {}
	): Promise<RecruitmentPostSummary[]> => {
		const params = new URLSearchParams();
		if (filters.category) params.set("category", filters.category);
		if (filters.memberType) params.set("memberType", filters.memberType);
		if (filters.region) params.set("region", filters.region);

		const qs = params.toString();
		const res = await apiGet<RecruitmentPostSummary[]>(
			`${apiRoutes.posts.publicRoot}${qs ? `?${qs}` : ""}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

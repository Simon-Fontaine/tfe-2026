import type {
	RecruitmentApplicationReviewSummary,
	RecruitmentApplicationSummary,
	RecruitmentListingCategory,
	RecruitmentListingSummary,
} from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import type { RecruitEntityOption } from "@/lib/recruitment";
import {
	type RouteStateResult,
	routeStateMissing,
	routeStateNoAccess,
	routeStateSuccess,
} from "@/lib/route-state";
import { getOrgsForUser } from "./organization";

export type {
	RecruitmentListingCategory,
	RecruitmentListingSummary,
	RecruitmentApplicationSummary,
	RecruitmentApplicationReviewSummary,
};

export const getManageableRecruitEntities = cache(
	async (userId: string): Promise<RecruitEntityOption[]> => {
		const orgs = (await getOrgsForUser(userId)).filter((org) => org.canManage);
		return orgs.flatMap((org) => {
			const orgOption: RecruitEntityOption = {
				id: org.id,
				type: "organization",
				label: `${org.name} organization`,
			};

			const teamOptions: RecruitEntityOption[] = org.teams
				.filter((team) => team.canManage)
				.map((team) => ({
					id: team.id,
					type: "team",
					label: `[${team.tag}] ${team.name}`,
					organizationId: org.id,
				}));

			return [orgOption, ...teamOptions];
		});
	}
);

export const getRecruitmentListings = cache(
	async (
		filters: {
			category?: RecruitmentListingCategory;
			memberType?: "player" | "staff";
			ownerType?: "player" | "team" | "organization";
			teamId?: string;
			organizationId?: string;
			region?: string;
			role?: string;
			rankFilter?: string;
		} = {}
	): Promise<RecruitmentListingSummary[]> => {
		const params = new URLSearchParams();
		if (filters.category) params.set("category", filters.category);
		if (filters.memberType) params.set("memberType", filters.memberType);
		if (filters.ownerType) params.set("ownerType", filters.ownerType);
		if (filters.teamId) params.set("teamId", filters.teamId);
		if (filters.organizationId) params.set("organizationId", filters.organizationId);
		if (filters.region) params.set("region", filters.region);
		if (filters.role) params.set("role", filters.role);
		if (filters.rankFilter) params.set("rankFilter", filters.rankFilter);

		const qs = params.toString();
		const res = await apiGet<RecruitmentListingSummary[]>(
			`${apiRoutes.recruitment.listings.root}${qs ? `?${qs}` : ""}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getMyRecruitmentListings = cache(async (): Promise<RecruitmentListingSummary[]> => {
	const res = await apiGet<RecruitmentListingSummary[]>(apiRoutes.recruitment.listings.mine);
	if ("data" in res) return res.data;
	throw new Error(res.error);
});

export const getMyRecruitmentApplications = cache(
	async (): Promise<RecruitmentApplicationSummary[]> => {
		const res = await apiGet<RecruitmentApplicationSummary[]>(
			apiRoutes.recruitment.applications.mine
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getRecruitmentApplicationsForListing = cache(
	async (listingId: string): Promise<RecruitmentApplicationReviewSummary[]> => {
		const res = await apiGet<RecruitmentApplicationReviewSummary[]>(
			apiRoutes.recruitment.listings.applications(listingId)
		);
		if ("data" in res) return res.data;
		if (res.status === 403 || res.status === 404) return [];
		throw new Error(res.error);
	}
);

export const getPublicRecruitmentListings = cache(
	async (
		filters: {
			category?: RecruitmentListingCategory;
			memberType?: "player" | "staff";
			region?: string;
			role?: string;
			rankFilter?: string;
		} = {}
	): Promise<RecruitmentListingSummary[]> => {
		const params = new URLSearchParams();
		if (filters.category) params.set("category", filters.category);
		if (filters.memberType) params.set("memberType", filters.memberType);
		if (filters.region) params.set("region", filters.region);
		if (filters.role) params.set("role", filters.role);
		if (filters.rankFilter) params.set("rankFilter", filters.rankFilter);

		const qs = params.toString();
		const res = await apiGet<RecruitmentListingSummary[]>(
			`${apiRoutes.recruitment.listings.publicRoot}${qs ? `?${qs}` : ""}`
		);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getRecruitmentListingRouteState = cache(
	async (listingId: string): Promise<RouteStateResult<RecruitmentListingSummary>> => {
		const res = await apiGet<RecruitmentListingSummary>(
			apiRoutes.recruitment.listings.byId(listingId)
		);
		if ("data" in res) return routeStateSuccess(res.data);
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess();
		throw new Error(res.error);
	}
);

export const getPublicRecruitmentListingById = cache(
	async (listingId: string): Promise<RecruitmentListingSummary | null> => {
		const res = await apiGet<RecruitmentListingSummary>(
			apiRoutes.recruitment.listings.publicById(listingId)
		);
		if ("data" in res) return res.data;
		if (res.status === 404) return null;
		throw new Error(res.error);
	}
);

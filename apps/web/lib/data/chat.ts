import type { ChatConversationSummary, RecruitmentConversationSummary } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import {
	type RouteStateResult,
	routeStateMissing,
	routeStateNoAccess,
	routeStateSuccess,
} from "@/lib/route-state";

export const getMyRecruitmentConversationSummaries = cache(
	async (): Promise<RecruitmentConversationSummary[]> => {
		const res = await apiGet<RecruitmentConversationSummary[]>(apiRoutes.recruitment.conversations);
		if ("data" in res) return res.data;
		throw new Error(res.error);
	}
);

export const getTeamChatRouteState = cache(
	async (teamId: string): Promise<RouteStateResult<ChatConversationSummary[]>> => {
		const res = await apiGet<ChatConversationSummary[]>(apiRoutes.chat.teamConversations(teamId));
		if ("data" in res) return routeStateSuccess(res.data);
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess(res.reason);
		throw new Error(res.error);
	}
);

export const getScrimChatRouteState = cache(
	async (scrimId: string): Promise<RouteStateResult<ChatConversationSummary[]>> => {
		const res = await apiGet<ChatConversationSummary[]>(apiRoutes.chat.scrimConversations(scrimId));
		if ("data" in res) return routeStateSuccess(res.data);
		if (res.status === 404) return routeStateMissing();
		if (res.status === 403) return routeStateNoAccess(res.reason);
		throw new Error(res.error);
	}
);
